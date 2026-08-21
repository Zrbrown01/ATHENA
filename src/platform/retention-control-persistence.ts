import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { legalHolds, previewEvents, previewOutbox, retentionDispositionReviews } from "../../db/schema";
import type { RetentionControlCommand } from "@/domain/platform/retention-controls";
import type { RetentionDecision } from "@/domain/platform/retention-policy";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function listLegalHolds(tenantId:string,matterId:string){return getPreviewDb().select().from(legalHolds).where(and(eq(legalHolds.tenantId,tenantId),eq(legalHolds.matterId,matterId))).orderBy(desc(legalHolds.placedAt));}
export async function readLegalHold(tenantId:string,matterId:string,holdId:string){const [row]=await getPreviewDb().select().from(legalHolds).where(and(eq(legalHolds.tenantId,tenantId),eq(legalHolds.matterId,matterId),eq(legalHolds.id,holdId))).limit(1);return row??null;}
export async function listRetentionReviews(tenantId:string,matterId:string){return getPreviewDb().select().from(retentionDispositionReviews).where(and(eq(retentionDispositionReviews.tenantId,tenantId),eq(retentionDispositionReviews.matterId,matterId))).orderBy(desc(retentionDispositionReviews.reviewedAt)).limit(12);}

export async function persistRetentionControl(input:{command:RetentionControlCommand;event:EventEnvelope<Record<string,unknown>>;actor:RequestActor;evaluation?:RetentionDecision}){
  const db=getPreviewDb();const [prior]=await db.select({eventId:previewEvents.eventId}).from(previewEvents).where(and(eq(previewEvents.tenantId,input.event.tenantId),eq(previewEvents.idempotencyKey,input.event.idempotencyKey))).limit(1);if(prior)return{replayed:true};
  const now=new Date(input.event.occurredAt),eventWrite=db.insert(previewEvents).values({eventId:input.event.eventId,eventType:input.event.eventType,eventVersion:input.event.eventVersion,tenantId:input.event.tenantId,aggregateType:input.event.aggregateType,aggregateId:input.event.aggregateId,matterId:input.event.matterId,actorId:input.actor.userId,occurredAt:now,correlationId:input.event.correlationId,causationId:input.event.causationId,idempotencyKey:input.event.idempotencyKey,source:input.event.source,visibility:input.event.visibility,retentionPolicy:input.event.retentionPolicy,payload:input.event.payload}),outboxWrite=db.insert(previewOutbox).values({id:createId(),tenantId:input.event.tenantId,eventId:input.event.eventId,topic:"athena.retention",payload:input.event,attempts:0,availableAt:now});
  if(input.command.action==="place_hold"){
    const holdName=input.command.name,existing=(await listLegalHolds(input.command.tenantId,input.command.matterId)).find(h=>h.name===holdName),revision=(existing?.revision??0)+1;if(existing?.status==="active")throw new Error("An active legal hold with this name already exists");
    await db.batch([db.insert(legalHolds).values({id:existing?.id??createId(),tenantId:input.command.tenantId,matterId:input.command.matterId,name:input.command.name,reason:input.command.reason,status:"active",placedBy:input.actor.userId,placedAt:now,releasedBy:null,releasedAt:null,releaseReason:null,revision}).onConflictDoUpdate({target:[legalHolds.tenantId,legalHolds.matterId,legalHolds.name],set:{reason:input.command.reason,status:"active",placedBy:input.actor.userId,placedAt:now,releasedBy:null,releasedAt:null,releaseReason:null,revision}}),eventWrite,outboxWrite]);
  }else if(input.command.action==="release_hold"){
    const current=await readLegalHold(input.command.tenantId,input.command.matterId,input.command.holdId);if(!current||current.status!=="active"||current.revision!==input.command.expectedRevision)throw new Error("Legal hold changed; refresh before retrying");await db.batch([db.update(legalHolds).set({status:"released",releasedBy:input.actor.userId,releasedAt:now,releaseReason:input.command.reason,revision:current.revision+1}).where(and(eq(legalHolds.id,current.id),eq(legalHolds.status,"active"),eq(legalHolds.revision,input.command.expectedRevision))),eventWrite,outboxWrite]);
  }else{
    if(!input.evaluation)throw new Error("Retention evaluation is required");await db.batch([db.insert(retentionDispositionReviews).values({id:input.event.aggregateId,tenantId:input.command.tenantId,matterId:input.command.matterId,policyCode:input.evaluation.policyCode,policyVersion:input.evaluation.policyVersion,evaluationOutcome:input.evaluation.outcome,evaluationReason:input.evaluation.reason,activeLegalHold:input.evaluation.outcome==="held",conclusion:input.command.conclusion,notes:input.command.notes,reviewedBy:input.actor.userId,reviewedAt:now}),eventWrite,outboxWrite]);
  }return{replayed:false};
}
