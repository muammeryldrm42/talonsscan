export default function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <svg width="72" height="22" />;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 72},${21 - ((v - mn) / rng) * 20}`).join(" ");
  return <svg width="72" height="22" viewBox="0 0 72 22"><polyline fill="none" stroke={up ? "#35c98d" : "#ff5c7a"} strokeWidth="1.5" points={pts} /></svg>;
}
