"use client";
import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/stats";
import { fmtUsd } from "@/lib/format";

export default function Chart({ candles, scale }: { candles: Candle[]; scale: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = createChart(ref.current, {
      layout: { background: { color: "transparent" }, textColor: "#8a97b8", fontFamily: "IBM Plex Sans" },
      grid: { vertLines: { color: "#1f2a44" }, horzLines: { color: "#1f2a44" } },
      rightPriceScale: { borderColor: "#1f2a44" }, timeScale: { borderColor: "#1f2a44", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 }, autoSize: true,
    });
    series.current = chart.current.addCandlestickSeries({ upColor: "#35c98d", downColor: "#ff5c7a", borderVisible: false, wickUpColor: "#35c98d", wickDownColor: "#ff5c7a", priceFormat: { type: "custom", formatter: (v: number) => fmtUsd(v, { sub: true }), minMove: 1e-12 } });
    return () => { chart.current?.remove(); chart.current = null; };
  }, []);
  useEffect(() => {
    if (!series.current) return;
    series.current.setData(candles.map((c) => ({ time: c.time as any, open: c.open * scale, high: c.high * scale, low: c.low * scale, close: c.close * scale })));
    chart.current?.timeScale().fitContent();
  }, [candles, scale]);
  return <div ref={ref} className="h-[380px] w-full" />;
}
