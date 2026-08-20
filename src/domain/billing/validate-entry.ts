import { z } from "zod";

export const billingEntry = z.object({
  minutes: z.number().int().positive().max(1440),
  narrative: z.string().trim().min(1).max(2000),
  taskCode: z.string().trim().min(1).max(20),
  activityCode: z.string().trim().min(1).max(20),
});

export type BillingRuleProfile = {
  ruleCode: string;
  ruleVersion: string;
  allowedTaskCodes: string[];
  allowedActivityCodes: string[];
  minimumNarrativeLength: number;
  maximumMinutesPerEntry: number;
};

export const summitSyntheticBillingProfile: BillingRuleProfile = {
  ruleCode: "SUMMIT-NARRATIVE-001",
  ruleVersion: "2026.1",
  allowedTaskCodes: ["L120", "L210", "L330"],
  allowedActivityCodes: ["A104", "A106", "A108"],
  minimumNarrativeLength: 40,
  maximumMinutesPerEntry: 480,
};

export function validateBillingEntry(raw: unknown, profile: BillingRuleProfile) {
  const entry = billingEntry.parse(raw);
  const hardStops: string[] = [];
  const warnings: string[] = [];
  if (!profile.allowedTaskCodes.includes(entry.taskCode)) hardStops.push(`Task code ${entry.taskCode} is not allowed.`);
  if (!profile.allowedActivityCodes.includes(entry.activityCode)) hardStops.push(`Activity code ${entry.activityCode} is not allowed.`);
  if (entry.minutes > profile.maximumMinutesPerEntry) hardStops.push(`Entry exceeds the ${profile.maximumMinutesPerEntry}-minute client limit.`);
  if (entry.narrative.length < profile.minimumNarrativeLength) warnings.push(`Narrative is shorter than ${profile.minimumNarrativeLength} characters.`);
  const outcome = hardStops.length ? "hard_stop" : warnings.length ? "warning" : "pass";
  const messages = [...hardStops, ...warnings];
  return { entry, outcome: outcome as "pass" | "warning" | "hard_stop", ruleCode: profile.ruleCode, ruleVersion: profile.ruleVersion, explanation: messages.length ? messages.join(" ") : "Narrative identifies the reviewed evidence, legal analysis, and resulting work product; task and activity codes are allowed for this client profile." };
}
