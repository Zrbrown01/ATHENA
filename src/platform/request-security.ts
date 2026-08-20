export class RequestSecurityError extends Error {
  constructor(message = "Untrusted request origin") { super(message); this.name = "RequestSecurityError"; }
}

export function assertTrustedWriteOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) throw new RequestSecurityError();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new RequestSecurityError();
}
