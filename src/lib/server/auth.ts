const te = new TextEncoder();

export function newSaltB64(bytes = 16) {
  const salt = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToB64(salt);
}

export async function hashPasswordPBKDF2(password: string, saltB64: string) {
  const salt = b64ToBytes(saltB64);
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    key,
    256
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function verifyPassword(password: string, saltB64: string, expectedHashB64: string) {
  const got = await hashPasswordPBKDF2(password, saltB64);
  return timingSafeEqual(got, expectedHashB64);
}

export async function signJWT(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj: any) => base64url(JSON.stringify(obj));
  const data = `${enc(header)}.${enc(payload)}`;
  const sig = await hmacSHA256(data, secret);
  return `${data}.${sig}`;
}

export async function verifyJWT(token: string, secret: string) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const data = `${h}.${p}`;
  const expected = await hmacSHA256(data, secret);
  if (!timingSafeEqual(expected, s)) return null;
  return JSON.parse(base64urlDecode(p));
}

async function hmacSHA256(data: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return base64urlBytes(new Uint8Array(sig));
}

export function timingSafeEqual(a: string, b: string) {
  const ab = te.encode(a);
  const bb = te.encode(b);
  if (ab.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ab.length; i++) out |= ab[i] ^ bb[i];
  return out === 0;
}

export function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (const c of bytes) s += String.fromCharCode(c);
  return btoa(s);
}
export function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64url(str: string) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function base64urlBytes(bytes: Uint8Array) {
  let s = "";
  for (const c of bytes) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function base64urlDecode(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return atob(b64);
}
