import { fmtPct } from "@/lib/format";
export default function Pct({ v }: { v: number | null | undefined }) {
  const x = v ?? null;
  return <span className={x == null ? "text-mist" : x >= 0 ? "text-up" : "text-down"}>{fmtPct(x)}</span>;
}
