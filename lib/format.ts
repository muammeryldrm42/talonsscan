export function fmtUsd(n: number, opts: { sub?: boolean } = {}): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  if (!opts.sub) return `$${n.toExponential(2)}`;
  // subscript zero notation: 0.0(5)123
  const s = n.toFixed(20).replace(/0+$/, "");
  const m = s.match(/^0\.(0+)(\d+)/);
  if (!m) return `$${n.toPrecision(3)}`;
  return `$0.0${toSub(m[1].length)}${m[2].slice(0, 4)}`;
}
function toSub(n: number): string {
  const map: Record<string, string> = { "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089" };
  return String(n).split("").map((c) => map[c]).join("");
}
export function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "..";
  const a = Math.abs(n);
  const v = a >= 1000 ? `${(a / 1000).toFixed(1)}K` : a.toFixed(a >= 100 ? 0 : 1);
  return `${n < 0 ? "-" : "+"}${v}%`;
}
export function fmtAge(ts: number, now = Date.now() / 1000): string {
  if (!ts) return "..";
  const d = Math.max(0, now - ts);
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  return `${Math.floor(d / (86400 * 30))}mo`;
}
export function fmtNum(n: number): string {
  if (!isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n >= 1 ? 2 : 4);
}
export const short = (a: string) => `${a.slice(0, 6)}..${a.slice(-4)}`;
