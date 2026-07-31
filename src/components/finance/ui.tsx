import { type ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "accent";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "warning"
          ? "text-warning"
          : tone === "accent"
            ? "text-accent"
            : "text-foreground";

  return (
    <div className="panel p-4">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        {suffix ? <span className="text-[0.65rem] opacity-70">{suffix}</span> : null}
      </span>
      {children}
    </label>
  );
}
