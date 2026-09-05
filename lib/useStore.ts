"use client";
import { useEffect, useMemo, useState } from "react";
import { store } from "./store";
import { buildRows } from "./stats";

export function useStore() {
  const [v, setV] = useState(0);
  useEffect(() => { store.start(); return store.subscribe(() => setV(store.version)); }, []);
  // Rows recompute at most every second so the table does not flicker while chunks stream in
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const rows = useMemo(() => buildRows(store.pools, store.tokens, store.swaps), [tick, v > 0 && store.progress.phase]);
  return { store, rows, progress: store.progress, version: v };
}
