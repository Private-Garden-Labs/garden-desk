import type { Env } from "./index";

export async function isOwner(request: Request, env: Env): Promise<boolean> {
  const [header, payload, signature] = (request.headers.get("cf-access-jwt-assertion") ?? "").split(
    ".",
  );
  if (header === undefined || payload === undefined || signature === undefined) return false;
  try {
    const { kid } = JSON.parse(text(header)) as { kid?: string };
    const claims = JSON.parse(text(payload)) as {
      aud?: string | string[];
      exp?: number;
      iss?: string;
    };
    const certs = await fetch(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    const { keys } = (await certs.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = keys.find((key) => key.kid === kid);
    if (jwk === undefined) return false;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const signed = new TextEncoder().encode(`${header}.${payload}`);
    return (
      (await crypto.subtle.verify(algorithm, key, bytes(signature), signed)) &&
      claims.iss === env.ACCESS_TEAM_DOMAIN &&
      [claims.aud].flat().includes(env.ACCESS_AUD) &&
      (claims.exp ?? 0) > Date.now() / 1000
    );
  } catch {
    return false;
  }
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64url.replace(/-/gu, "+").replace(/_/gu, "/")), (c) =>
    c.charCodeAt(0),
  );
}

function text(base64url: string): string {
  return new TextDecoder().decode(bytes(base64url));
}
