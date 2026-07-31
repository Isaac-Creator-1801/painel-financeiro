import { Field } from "./ui";
import { n, type Ticket } from "@/lib/finance";

export function TicketSettings({
  tickets,
  onChange,
}: {
  tickets: Ticket[];
  onChange: (tickets: Ticket[]) => void;
}) {
  const update = (id: string, patch: Partial<Ticket>) =>
    onChange(tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tickets e comissão</h2>
          <p className="text-xs text-muted-foreground">
            Informe o preço do ticket e quanto você recebe por venda.
          </p>
        </div>
        <button
          onClick={() =>
            onChange([
              ...tickets,
              {
                id: crypto.randomUUID(),
                label: "Novo ticket",
                price: 0,
                net: 0,
              },
            ])
          }
          className="rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-surface-2"
        >
          + Adicionar ticket
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
            <Field label="Nome">
              <input
                className="field"
                value={t.label}
                onChange={(e) => update(t.id, { label: e.target.value })}
              />
            </Field>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Preço (R$)">
                <input
                  className="field tabular-nums"
                  type="number"
                  min="0"
                  step="0.01"
                  value={t.price}
                  onChange={(e) => update(t.id, { price: n(e.target.value) })}
                />
              </Field>
              <Field label="Recebo (R$)">
                <input
                  className="field tabular-nums"
                  type="number"
                  min="0"
                  step="0.01"
                  value={t.net}
                  onChange={(e) => update(t.id, { net: n(e.target.value) })}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {t.price ? `${((t.net / t.price) * 100).toFixed(1)}% do ticket` : "—"}
            </p>

            {tickets.length > 1 ? (
              <button
                onClick={() => onChange(tickets.filter((x) => x.id !== t.id))}
                className="mt-2 text-xs text-negative transition-opacity hover:opacity-80"
              >
                Remover
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
