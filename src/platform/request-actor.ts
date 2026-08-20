export type RequestActor = {
  userId: string;
  email: string;
  displayName: string;
};

export function requestActor(request: Request): RequestActor | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");

  if (userId && email) {
    const fullName = encodedName && encoding === "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : null;
    return { userId, email, displayName: fullName ?? email };
  }

  if (process.env.NODE_ENV !== "production") {
    return { userId: "user-maya-chen", email: "maya.chen@example.test", displayName: "Maya Chen" };
  }

  return null;
}

function safeDecode(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
