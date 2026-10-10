import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Continue with Google" via OpenID Connect authorization-code + PKCE.
 * Enabled only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 * ID tokens are read from Google's token endpoint over TLS, which OIDC
 * allows in place of signature verification (Core §3.1.3.7); issuer,
 * audience, expiry and nonce are still checked.
 */
const env = (k: string) => process.env[k]?.trim() || undefined;
export const googleEnabled = () => Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
export const STATE_COOKIE = "cl_oauth";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function appOrigin(req: Request) {
  return env("APP_URL")?.replace(/\/$/, "") ?? new URL(req.url).origin;
}
const redirectUri = (req: Request) => `${appOrigin(req)}/api/auth/oauth/google/callback`;

type State = { state: string; nonce: string; verifier: string; next: string; createdAt: number };

function secret() {
  const s = env("AUTH_SECRET") ?? env("GOOGLE_CLIENT_SECRET");
  if (!s) throw new Error("OAuth is not configured");
  return s;
}

export function newState(next: string): State {
  return { state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)), verifier: b64url(randomBytes(32)), next, createdAt: Date.now() };
}
export function sealState(s: State) {
  const body = b64url(JSON.stringify(s));
  return `${body}.${b64url(createHmac("sha256", secret()).update(body).digest())}`;
}
export function openState(raw: string | undefined): State | null {
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const s = JSON.parse(Buffer.from(body, "base64url").toString()) as State;
  return Date.now() - s.createdAt < 10 * 60_000 ? s : null;
}

export function authorizationUrl(req: Request, s: State) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID")!,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state: s.state,
    nonce: s.nonce,
    code_challenge: b64url(createHash("sha256").update(s.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

export async function exchangeCode(req: Request, s: State, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(req), client_id: env("GOOGLE_CLIENT_ID")!, client_secret: env("GOOGLE_CLIENT_SECRET")!, code_verifier: s.verifier }),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new Error(`Token exchange failed: ${data.error ?? res.status}`);
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString()) as Record<string, unknown>;
  const issOk = ["https://accounts.google.com", "accounts.google.com"].includes(String(claims.iss));
  const audOk = claims.aud === env("GOOGLE_CLIENT_ID");
  if (!issOk || !audOk || Number(claims.exp) * 1000 < Date.now() || claims.nonce !== s.nonce || !claims.sub) throw new Error("ID token failed validation");
  return {
    subject: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
  };
}

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
