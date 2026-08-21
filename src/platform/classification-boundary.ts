import {
  evaluateClassification,
  type Label,
  type Plane,
} from "@/domain/classification/policy";
import {
  readClassification,
  readClassificationOverride,
} from "./classification-persistence";
import type { TenantContext } from "./tenant-context";

export class ClassificationDeniedError extends Error {
  constructor(
    readonly plane: Plane,
    readonly reasonCodes: string[],
  ) {
    super(`Classification policy denied ${plane}`);
  }
}

export async function authorizeClassifiedUse(input: {
  context: TenantContext;
  tenantId: string;
  matterId: string;
  resourceType: string;
  resourceId: string;
  plane: Plane;
}) {
  const row = await readClassification(
    input.tenantId,
    input.resourceType,
    input.resourceId,
  );
  if (!row)
    return {
      outcome: "allow" as const,
      reasonCodes: ["no_active_resource_classification"],
      overrideId: null,
      labels: [] as Label[],
      policyVersion: null,
    };
  const override = await readClassificationOverride(
    input.tenantId,
    input.resourceType,
    input.resourceId,
    input.plane,
  );
  const result = evaluateClassification({
    context: input.context,
    tenantId: input.tenantId,
    matterId: input.matterId,
    plane: input.plane,
    labels: row.labels as Label[],
    override: override
      ? {
          id: override.id,
          plane: override.plane,
          status: override.status,
          expiresAt: override.expiresAt,
        }
      : null,
  });
  if (result.outcome === "deny")
    throw new ClassificationDeniedError(input.plane, result.reasonCodes);
  return {
    ...result,
    labels: row.labels as Label[],
    policyVersion: row.policyVersion,
  };
}
