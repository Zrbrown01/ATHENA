export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  matterAccess: Set<string>;
}

export class AuthorizationError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function authorizeMatter(context: TenantContext, tenantId: string, matterId: string) {
  if (context.tenantId !== tenantId || !context.matterAccess.has(matterId)) {
    throw new AuthorizationError();
  }
}

export function requireRole(context: TenantContext, permittedRoles: string[]) {
  if (!context.roles.some((role) => permittedRoles.includes(role))) {
    throw new AuthorizationError("This action requires an authorized legal reviewer");
  }
}
