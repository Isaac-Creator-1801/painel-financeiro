import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EntriesTable } from "@/components/finance/EntriesTable";
import { EntryForm } from "@/components/finance/EntryForm";
import { TicketSettings } from "@/components/finance/TicketSettings";
import { StatCard } from "@/components/finance/ui";
import {
  brl,
  costBreakdown,
  dailyAdSpend,
  emptyEntry,
  loadEntries,
  loadTickets,
  monthKey,
  monthLabel,
  pct,
  previousInvoice,
  saveEntries,
  saveTickets,
  sumMetrics,
  toCsv,
  type DayEntry,
  type Ticket,
} from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle Financeiro da Operação | Painel de Vendas e Gastos" },
      {
        name: "description",
        content:
          "Painel dinâmico para lançar vendas por ticket, gastos com anúncios, criativos, automação e pedidos frustrados, com lucro e ROAS por dia e por mês.",
      },
      { property: "og:title", content: "Controle Financeiro da Operação" },
      {
        property: "og:description",
        content:
          "Lance vendas por ticket e gastos diários e acompanhe retorno líquido, lucro, ROAS e margem da sua operação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [draft, setDraft] = useState<DayEntry>(() => emptyEntry());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTickets(loadTickets());
    setEntries(loadEntries());
    setDraft(emptyEntry());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveTickets(tickets);
  }, [tickets, ready]);

  useEffect(() => {
    if (ready) saveEntries(entries);
  }, [entries, ready]);

  const months = useMemo(
    () => Array.from(new Set(entries.map((e) => monthKey(e.date)))).sort().reverse(),
    [entries],
  );

  const derived = useMemo(() => dailyAdSpend(entries), [entries]);

  const filtered = useMemo(
    () =>
      derived
        .filter((e) => month === "all" || monthKey(e.date) === month)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [derived, month],
  );

  const draftPrevInvoice = useMemo(
    () => previousInvoice(entries, draft.date, editingId ?? undefined),
    [entries, draft.date, editingId],
  );

  const totals = useMemo(() => sumMetrics(filtered, tickets), [filtered, tickets]);
  const costs = useMemo(() => costBreakdown(filtered), [filtered]);

  const saveDraft = () => {
    if (editingId) {
      setEntries((prev) => prev.map((e) => (e.id === editingId ? draft : e)));
      setEditingId(null);
    } else {
      setEntries((prev) => [...prev, draft]);
    }
    setDraft(emptyEntry());
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered, tickets)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `controle-financeiro-${month === "all" ? "geral" : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const costRows = [
    { label: "Anúncios / tráfego", value: costs.adSpend },
    { label: "Criativos", value: costs.creativeCost },
    { label: "Plataforma de automação", value: costs.automationCost },
    { label: "Pedidos frustrados", value: costs.frustratedCost },
    { label: "Outros", value: costs.otherCost },
  ].sort((a, b) => b.value - a.value);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-primary">
            Operação · controle diário
          </p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Controle Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas por ticket, gastos e lucro real — dia a dia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">Todo o período</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            {showSettings ? "Fechar tickets" : "Tickets"}
          </button>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Retorno líquido (comissão)"
          value={brl(totals.revenue)}
          hint={`Faturamento bruto ${brl(totals.gross)}`}
          tone="positive"
        />
        <StatCard
          label="Gastos totais"
          value={brl(totals.costs)}
          hint={`Anúncios ${brl(costs.adSpend)}`}
          tone="warning"
        />
        <StatCard
          label="Lucro líquido"
          value={brl(totals.profit)}
          hint={`Margem ${pct(totals.margin)}`}
          tone={totals.profit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="ROAS · vendas"
          value={totals.roas ? `${totals.roas.toFixed(2)}x` : "—"}
          hint={`${totals.units} pedidos · CPA ${totals.cpa ? brl(totals.cpa) : "—"}`}
          tone="accent"
        />
      </div>

      {showSettings ? (
        <div className="mt-6">
          <TicketSettings tickets={tickets} onChange={setTickets} />
        </div>
      ) : null}

      <div className="mt-6">
        <EntryForm
          tickets={tickets}
          entry={draft}
          onChange={setDraft}
          onSave={saveDraft}
          editing={Boolean(editingId)}
          prevInvoice={draftPrevInvoice}
          onCancel={
            editingId
              ? () => {
                  setEditingId(null);
                  setDraft(emptyEntry());
                }
              : undefined
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <EntriesTable
          entries={filtered}
          tickets={tickets}
          onEdit={(e) => {
            const original = entries.find((x) => x.id === e.id) ?? e;
            setDraft(original);
            setEditingId(original.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        />

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Para onde vai o dinheiro</h2>
          <p className="text-xs text-muted-foreground">Distribuição dos gastos no período.</p>
          <div className="mt-4 space-y-3">
            {costRows.map((row) => {
              const share = totals.costs > 0 ? row.value / totals.costs : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="tabular-nums">{brl(row.value)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, share * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos no período</span>
              <span className="tabular-nums">{totals.units}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Ticket médio líquido</span>
              <span className="tabular-nums">
                {totals.units ? brl(totals.revenue / totals.units) : "—"}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Lucro por pedido</span>
              <span className="tabular-nums">
                {totals.units ? brl(totals.profit / totals.units) : "—"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Os dados ficam salvos neste navegador. Use “Exportar CSV” para backup ou para abrir no Excel.
      </p>
    </main>
  );
}
