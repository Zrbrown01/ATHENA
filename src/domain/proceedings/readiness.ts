import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

export const proceedingTypes = ["status_conference","priority_conference","msc","rating_msc","lien_conference","expedited_hearing","trial","petition_reconsideration","petition_reopen","settlement_approval","other"] as const;
export const proceedingItemCodes = ["issues","discovery","medical_records","service","exhibits","witnesses","adjuster_availability","authority","interpreter","pretrial_statement","client_report","filing_status"] as const;
export type ProceedingItemCode = typeof proceedingItemCodes[number];
type Category = "missing_data"|"missing_document"|"inconsistency"|"client_decision"|"court_requirement"|"firm_preference"|"external_dependency";
type Severity = "critical"|"high"|"normal"|"info";
export type ProceedingItemState = { code:ProceedingItemCode; label:string; category:Category; severity:Severity; status:"missing"|"verified"|"not_required"; evidenceType?:string|null; evidenceId?:string|null; providerMode:"athena_native"|"human_verified_external"; revision:number };

export const proceedingItemDefinitions: Record<ProceedingItemCode,{label:string;category:Category;severity:Severity;providerMode:"athena_native"|"human_verified_external"}> = {
  issues:{label:"Issues",category:"missing_data",severity:"high",providerMode:"athena_native"},
  discovery:{label:"Discovery",category:"firm_preference",severity:"high",providerMode:"athena_native"},
  medical_records:{label:"Medical records",category:"missing_document",severity:"critical",providerMode:"athena_native"},
  service:{label:"Service",category:"court_requirement",severity:"critical",providerMode:"athena_native"},
  exhibits:{label:"Exhibits",category:"missing_document",severity:"high",providerMode:"athena_native"},
  witnesses:{label:"Witnesses",category:"missing_data",severity:"high",providerMode:"athena_native"},
  adjuster_availability:{label:"Adjuster availability",category:"client_decision",severity:"high",providerMode:"athena_native"},
  authority:{label:"Authority",category:"client_decision",severity:"critical",providerMode:"athena_native"},
  interpreter:{label:"Interpreter",category:"missing_data",severity:"normal",providerMode:"athena_native"},
  pretrial_statement:{label:"Pretrial statement",category:"missing_document",severity:"high",providerMode:"athena_native"},
  client_report:{label:"Client report",category:"missing_document",severity:"high",providerMode:"athena_native"},
  filing_status:{label:"Filing status",category:"external_dependency",severity:"critical",providerMode:"human_verified_external"},
};

const base={tenantId:z.string().min(1),matterId:z.string().min(1),proceedingId:z.string().min(3).max(120),idempotencyKey:z.string().min(8).max(200)};
export const proceedingCommand=z.discriminatedUnion("action",[
  z.object({action:z.literal("create"),...base,proceedingType:z.enum(proceedingTypes),title:z.string().trim().min(5).max(240),scheduledAt:z.iso.datetime(),venue:z.string().trim().min(3).max(240),sourceType:z.enum(["hearing_notice","attorney_entry","court_portal_manual"]),sourceId:z.string().min(3).max(200),contentStatus:z.enum(["synthetic_sandbox","pending_attorney_review","attorney_approved"])}),
  z.object({action:z.literal("verify_item"),...base,itemCode:z.enum(proceedingItemCodes),expectedRevision:z.number().int().positive(),evidence:z.string().trim().min(12).max(1500),evidenceType:z.enum(["document","event","human_attestation","provider_receipt"]),evidenceId:z.string().min(3).max(200),providerMode:z.enum(["athena_native","human_verified_external"])}),
  z.object({action:z.literal("mark_not_required"),...base,itemCode:z.enum(proceedingItemCodes),expectedRevision:z.number().int().positive(),evidence:z.string().trim().min(12).max(1500)}),
  z.object({action:z.literal("assess"),...base}),
]);
export type ProceedingCommand=z.infer<typeof proceedingCommand>;

export function evaluateProceedingReadiness(items:ProceedingItemState[], eamsConnected=false){
  const findings=items.map(item=>{
    if(item.status==="verified") return {...item,status:"pass" as const,explanation:`${item.label} has human-verifiable evidence.`};
    if(item.status==="not_required") return {...item,status:"not_applicable" as const,explanation:`${item.label} was marked not required with recorded human rationale.`};
    if(item.code==="filing_status"&&!eamsConnected) return {...item,status:"blocked" as const,category:"external_dependency" as const,explanation:"EAMS is disconnected; filing status requires a human-recorded external receipt or court verification."};
    return {...item,status:"gap" as const,explanation:`${item.label} evidence is missing.`};
  });
  const gaps=findings.filter(x=>x.status==="gap"),blocked=findings.filter(x=>x.status==="blocked"),criticalGaps=gaps.filter(x=>x.severity==="critical"&&x.code!=="authority"),authorityGap=gaps.some(x=>x.code==="authority"),normalGaps=gaps.filter(x=>x.severity==="normal");
  const state=criticalGaps.length?"blocked":authorityGap?"client_decision_required":blocked.length?"external_dependency":gaps.length===0?"ready":gaps.length===normalGaps.length?"ready_with_warning":"at_risk";
  return {state:state as "ready"|"ready_with_warning"|"at_risk"|"blocked"|"client_decision_required"|"external_dependency",findings,passCount:findings.filter(x=>x.status==="pass").length,gapCount:gaps.length,blockedCount:blocked.length,nonAutonomous:true,eamsConnected};
}

export function decideProceeding(input:{context:TenantContext;raw:unknown;exists?:boolean;item?:ProceedingItemState|null;evaluation?:ReturnType<typeof evaluateProceedingReadiness>}){
  const command=proceedingCommand.parse(input.raw);authorizeMatter(input.context,command.tenantId,command.matterId);requireRole(input.context,["attorney","partner","paralegal","legal_assistant","docketing"]);
  if(command.action==="create"&&input.exists)throw new Error("Proceeding already exists");
  if(command.action!=="create"&&!input.exists)throw new Error("Proceeding does not exist in this matter scope");
  if(command.action==="verify_item"||command.action==="mark_not_required"){
    if(!input.item||input.item.code!==command.itemCode)throw new Error("Readiness item does not exist");
    if(input.item.revision!==command.expectedRevision)throw new Error("Readiness item changed; refresh before retrying");
    if(input.item.status!=="missing")throw new Error("Readiness item already has a terminal human disposition");
    if(command.itemCode==="filing_status"&&command.action==="mark_not_required")throw new Error("Filing status cannot be marked not required");
    if(command.action==="verify_item"){
      const required=proceedingItemDefinitions[command.itemCode].providerMode;
      if(command.providerMode!==required)throw new Error(`${command.itemCode} requires ${required} evidence mode`);
      if(command.itemCode==="filing_status"&&!(["human_attestation","provider_receipt"] as string[]).includes(command.evidenceType))throw new Error("Filing status requires human-recorded external verification evidence");
    }
  }
  if(command.action==="assess"&&!input.evaluation)throw new Error("Proceeding evaluation is required");
  const suffix={create:"created",verify_item:"item_verified",mark_not_required:"item_not_required",assess:"assessed"}[command.action];
  const itemCode="itemCode" in command?command.itemCode:null;
  return {command,event:createEvent({eventType:`proceeding.${suffix}`,tenantId:command.tenantId,aggregateType:"proceeding",aggregateId:command.proceedingId,matterId:command.matterId,actorId:input.context.userId,correlationId:command.idempotencyKey,idempotencyKey:command.idempotencyKey,source:"athena.web",visibility:"restricted",retentionPolicy:"matter-lifecycle-plus-firm-retention",payload:{action:command.action,itemCode,readinessState:input.evaluation?.state??null,humanAuthorized:true,nonAutonomous:true,eamsConnected:false,externalProviderOperation:false}})};
}
