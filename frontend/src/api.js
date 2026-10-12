const KEY = "ledgerly.session";
export const session = {
  get: () => JSON.parse(localStorage.getItem(KEY) || "null"),
  set: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(KEY),
};

export async function api(path, { method = "GET", body } = {}) {
  const s = session.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && s) { session.clear(); location.reload(); }
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
