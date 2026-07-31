import { brl, entryMetrics, formatDate, type DayEntry, type Ticket } from "@/lib/finance";

export function EntriesTable({
  entries,
  tickets,
  onEdit,
  onDelete,
}: {
  entries: DayEntry[];
  tickets: Ticket[];
  onEdit: (entry: DayEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (!entries.length) {
    return (
      <section className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum lançamento neste período.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Preencha o formulário acima e clique em <strong>Adicionar dia</strong>. Depois, cada linha terá botões <strong>Editar</strong> e <strong>Excluir</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="panel overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Data</th>
            {tickets.map((t) => (
              <th key={t.id} className="px-2 py-3 text-right font-medium">
                {t.label}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-medium">Retorno</th>
            <th className="px-3 py-3 text-right font-medium">Anúncios</th>
            <th className="px-3 py-3 text-right font-medium">Custos</th>
            <th className="px-3 py-3 text-right font-medium">Lucro</th>
            <th className="px-3 py-3 text-right font-medium">ROAS</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const m = entryMetrics(e, tickets);
            return (
              <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-medium">{formatDate(e.date)}</span>
                  {e.note ? (
                    <span className="block text-xs text-muted-foreground">{e.note}</span>
                  ) : null}
                </td>
                {tickets.map((t) => (
                  <td key={t.id} className="px-2 py-3 text-right tabular-nums text-muted-foreground">
                    {e.sales[t.id] ?? 0}
                  </td>
                ))}
                <td className="px-3 py-3 text-right tabular-nums text-positive">{brl(m.revenue)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {brl(e.adSpend)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-warning">{brl(m.costs)}</td>
                <td
                  className={`px-3 py-3 text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-positive" : "text-negative"}`}
                >
                  {brl(m.profit)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {m.roas ? `${m.roas.toFixed(2)}x` : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <button
                    onClick={() => onEdit(e)}
                    className="rounded-md px-2 py-1 text-xs text-accent transition-colors hover:bg-surface-2"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="rounded-md px-2 py-1 text-xs text-negative transition-colors hover:bg-surface-2"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
