export function nowMs() {
  return Date.now();
}

export async function first<T = any>(stmt: D1PreparedStatement) {
  return (await stmt.first<T>()) ?? null;
}

export async function all<T = any>(stmt: D1PreparedStatement) {
  const r = await stmt.all<T>();
  return r.results ?? [];
}
