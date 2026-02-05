type Json = any;

/**
 * Deep merge for profile inheritance:
 * - objects merge recursively
 * - arrays: child overrides entirely (simple & predictable)
 */
export function mergeConfig(parent: Json, child: Json): Json {
  if (Array.isArray(parent) || Array.isArray(child)) return child ?? parent;
  if (!isObj(parent) || !isObj(child)) return child ?? parent;

  const out: any = { ...parent };
  for (const [k, v] of Object.entries(child)) {
    out[k] = k in parent ? mergeConfig((parent as any)[k], v) : v;
  }
  return out;
}

export function isObj(v: any) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function safeJsonParse<T = any>(s: any, fallback: T) {
  try {
    return JSON.parse(String(s ?? "")) as T;
  } catch {
    return fallback;
  }
}

export const DEFAULT_UI = {
  theme: { mode: "system", brand: "indigo" },
  modules: { bots: true, profiles: true, logs: true }
};

export const DEFAULT_LOGIC = {
  version: 1,
  routes: [
    { type: "command", match: "/start", action: { type: "send_message", text: "已连接✅" } }
  ]
};
