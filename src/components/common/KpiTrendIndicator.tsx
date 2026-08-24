import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Circle } from "lucide-react";

type KpiTrendIndicatorProps = {
  value: number;
  previousValue?: number | null;
  metricKey?: string;
  label: string;
};

type TrendSnapshot = { current: number; previous: number | null };

function readSnapshot(metricKey: string | undefined, value: number): TrendSnapshot {
  if (!metricKey) return { current: value, previous: null };
  try {
    const stored = localStorage.getItem(`aecs:kpi:${metricKey}`);
    if (!stored) return { current: value, previous: null };
    const parsed = JSON.parse(stored) as TrendSnapshot;
    return Number.isFinite(parsed.current) ? parsed : { current: value, previous: null };
  } catch {
    return { current: value, previous: null };
  }
}

export function KpiTrendIndicator({ value, previousValue, metricKey, label }: KpiTrendIndicatorProps) {
  const [snapshot, setSnapshot] = useState(() => readSnapshot(metricKey, value));

  useEffect(() => {
    if (!metricKey) return;
    setSnapshot(current => {
      const next = value === current.current ? current : { current: value, previous: current.current };
      try { localStorage.setItem(`aecs:kpi:${metricKey}`, JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
      return next;
    });
  }, [metricKey, value]);

  const baseline = typeof previousValue === "number" ? previousValue : snapshot.previous;
  const hasBaseline = typeof baseline === "number";
  const direction = !hasBaseline || value === baseline ? "neutral" : value > baseline ? "up" : "down";
  const difference = hasBaseline ? Math.abs(value - baseline) : 0;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Circle;
  const changeText = direction === "neutral" ? label : `${direction === "up" ? "+" : "−"}${Number.isInteger(difference) ? difference : difference.toFixed(1)} · ${label}`;

  return (
    <span className={`kpi-trend-indicator ${direction}`} title={`Previous recorded value: ${hasBaseline ? baseline : "No baseline yet"}`}>
      <Icon size={13} fill={direction === "neutral" ? "currentColor" : "none"} />
      <span>{changeText}</span>
    </span>
  );
}

export default KpiTrendIndicator;
