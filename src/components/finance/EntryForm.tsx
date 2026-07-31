import { useMemo, useState } from "react";
import { Field } from "./ui";
import {
  brl,
  entryMetrics,
  n,
  type DayEntry,
  type Ticket,
} from "@/lib/finance";

type Props = {
  tickets: Ticket[];
  entry: DayEntry;
  onChange: (entry: DayEntry) => void;
  onSave: () => void;
  onCancel?: () => void;
  editing: boolean;
  prevInvoice?: number;
};

export function EntryForm({
  tickets,
  entry,
  onChange,
  onSave,
  onCancel,
  editing,
  prevInvoice = 0,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dayAdSpend = Math.max(0, n(entry.adSpend) - prevInvoice);
  const metrics = useMemo(
    () => entryMetrics({ ...entry, adSpend: dayAdSpend }, tickets),
    [entry, tickets, dayAdSpend],
  );

  const set = (patch: Partial<DayEntry>) => onChange({ ...entry, ...patch });

  const setSale = (id: string, value: string) =>
    onChange({ ...entry, sales: { ...entry.sales, [id]: Math.max(0, Math.round(n(value))) } });

  const getLocalDateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const setToday = () => set({ date: getLocalDateString(0) });
  const setYesterday = () => set({ date: getLocalDateString(-1) });

  const numberInput = (value: number, onValue: (v: string) => void, step = "0.01") => (
    <input
      className="field tabular-nums"
      type="number"
      min="0"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onValue(e.target.value)}
    />
  );

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {editing ? "Editando lançamento" : "Novo lançamento do dia"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Preencha as vendas por ticket e os gastos daquele dia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Data do lançamento">
            <input
              className="field tabular-nums cursor-pointer font-medium"
              type="date"
              value={entry.date}
              onChange={(e) => {
                if (e.target.value) set({ date: e.target.value });
              }}
            />
          </Field>
          <div className="flex items-center gap-1 pb-0.5">
            <button
              type="button"
              onClick={setToday}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-xs font-medium transition-colors hover:bg-surface-3 hover:text-primary"
              title="Selecionar data de Hoje"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={setYesterday}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-xs font-medium transition-colors hover:bg-surface-3 hover:text-primary"
              title="Selecionar data de Ontem"
            >
              Ontem
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Vendas por ticket
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
              <Field
                label={t.label}
                suffix={`recebe ${brl(t.net)}${t.price ? ` · ${Math.round((t.net / t.price) * 100)}%` : ""}`}
              >
                {numberInput(entry.sales[t.id] ?? 0, (v) => setSale(t.id, v), "1")}
              </Field>
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                Líquido: {brl((entry.sales[t.id] ?? 0) * t.net)}
              </p>

            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Gastos do dia
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field
            label="Fatura de anúncios (acumulada)"
            suffix={`gasto do dia ${brl(dayAdSpend)} · anterior ${brl(prevInvoice)}`}
          >
            {numberInput(entry.adSpend, (v) => set({ adSpend: n(v) }))}
          </Field>
          <Field label="Zappcash">
            {numberInput(entry.automationCost, (v) => set({ automationCost: n(v) }))}
          </Field>
          <Field label="Criativos">
            {numberInput(entry.creativeCost, (v) => set({ creativeCost: n(v) }))}
          </Field>
          <Field label="Pedidos frustrados">
            {numberInput(entry.frustratedCost, (v) => set({ frustratedCost: n(v) }))}
          </Field>
          <Field label="Outros">
            {numberInput(entry.otherCost, (v) => set({ otherCost: n(v) }))}
          </Field>
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-4">
          <Field label="Observação do dia">
            <input
              className="field"
              value={entry.note ?? ""}
              placeholder="Ex.: escalei campanha nova"
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
        <div className="flex flex-wrap gap-6 text-sm tabular-nums">
          <span>
            <span className="text-muted-foreground">Retorno líquido: </span>
            <strong className="text-positive">{brl(metrics.revenue)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Custos: </span>
            <strong className="text-warning">{brl(metrics.costs)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Lucro: </span>
            <strong className={metrics.profit >= 0 ? "text-positive" : "text-negative"}>
              {brl(metrics.profit)}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAdvanced ? "Ocultar nota" : "+ Nota"}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-2"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {editing ? "Salvar alterações" : "Adicionar dia"}
          </button>
        </div>
      </div>
    </section>
  );
}
