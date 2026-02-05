const te = new TextEncoder();
const td = new TextDecoder();

/**
 * AES-GCM encrypt/decrypt helpers.
 * - key: base64 string (32 bytes recommended)
 * - cipher format: v1:<iv_b64>:<cipher_b64>
 */
export async function encryptTextAESGCM(plain: string, keyB64: string) {
  const keyBytes = b64ToBytes(keyB64);
  if (keyBytes.length < 16) throw new Error("BOT_TOKEN_KEY too short; use 32-byte base64 key");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(plain));

  return `v1:${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ct))}`;
}

export async function decryptTextAESGCM(cipher: string, keyB64: string) {
  const [v, ivB64, ctB64] = String(cipher).split(":");
  if (v !== "v1" || !ivB64 || !ctB64) throw new Error("Invalid cipher format");
  const keyBytes = b64ToBytes(keyB64);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);

  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return td.decode(pt);
}

export function randomHex(bytes = 24) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (const c of bytes) s += String.fromCharCode(c);
  return btoa(s);
}
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
