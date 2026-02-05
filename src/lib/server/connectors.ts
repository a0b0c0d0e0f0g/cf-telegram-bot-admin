export async function callConnector(env: any, connectorRow: any, input: any) {
  const method = String(connectorRow.method ?? "GET").toUpperCase();
  const endpoint = String(connectorRow.endpoint ?? "");
  if (!endpoint) throw new Error("connector endpoint missing");

  const headers = safeJson(connectorRow.headers_json, {});
  const authType = String(connectorRow.auth_type ?? "none");
  const secretName = connectorRow.auth_secret_name ? String(connectorRow.auth_secret_name) : "";

  if (authType === "bearer" && secretName) {
    const token = env[secretName];
    if (!token) throw new Error(`Missing secret: ${secretName}`);
    headers["authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = Number(connectorRow.timeout_ms ?? 8000);
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(input ?? {}),
      signal: controller.signal
    });

    const text = await res.text();
    const data = tryJson(text) ?? { raw: text };

    if (!res.ok) throw new Error(`Connector error: ${res.status} ${text}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

function safeJson(s: any, fallback: any) {
  try {
    return JSON.parse(String(s ?? "")) ?? fallback;
  } catch {
    return fallback;
  }
}
function tryJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
