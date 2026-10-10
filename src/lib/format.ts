export function formatDate(iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export function pct(p: number) {
  return `${Math.round(p)}%`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
