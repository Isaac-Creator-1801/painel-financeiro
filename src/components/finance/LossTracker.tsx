import {
  brl,
  calculateLossTracker,
  type DayEntry,
  type Ticket,
} from "@/lib/finance";

interface LossTrackerProps {
  entries: DayEntry[];
  tickets: Ticket[];
}

export function LossTracker({ entries, tickets }: LossTrackerProps) {
  const data = calculateLossTracker(entries, tickets);

  const {
    lossDays,
    totalPrevLoss,
    todayRevenue,
    todayAdSpend,
    todayUnits,
    coveredPastLoss,
    remainingPastLoss,
    totalUncovered,
    lossDayLabels,
  } = data;

  if (!entries.length) return null;

  return (
    <section className="panel relative overflow-hidden p-5 sm:p-6">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            totalUncovered > 0
              ? "radial-gradient(600px 300px at 80% -20%, oklch(0.68 0.2 22 / 0.12), transparent 60%)"
              : "radial-gradient(600px 300px at 80% -20%, oklch(0.79 0.16 160 / 0.12), transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-negative animate-pulse" />
            <h2 className="text-base font-semibold sm:text-lg">
              Rastreador de Prejuízo Acumulado
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dias sem venda geram prejuízo que precisa ser coberto nas vendas seguintes. Veja o status em tempo real.
          </p>
        </div>

        <div className="text-right">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {totalUncovered > 0 ? "Descoberto Hoje" : "Posição Operação"}
          </p>
          <p
            className={`font-display text-2xl font-bold tabular-nums ${
              totalUncovered > 0 ? "text-negative" : "text-positive"
            }`}
          >
            {totalUncovered > 0 ? `− ${brl(totalUncovered)}` : "✓ Coberto"}
          </p>
        </div>
      </div>

      {/* Timeline de Chips por Dia */}
      {lossDays.length > 0 && (
        <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lossDays.map((d) => {
            const isLoss = d.type === "loss";
            const isPartial = d.type === "partial";
            const isCovered = d.type === "covered";

            const totalDebt = d.prevLoss + d.adSpend;
            const coveragePct =
              totalDebt > 0 ? Math.min(100, (d.revenue / totalDebt) * 100) : 100;

            const chipBg = isLoss
              ? "bg-negative/10 border-negative/30"
              : isPartial
              ? "bg-warning/10 border-warning/30"
              : "bg-positive/10 border-positive/30";

            return (
              <div
                key={d.date}
                className={`rounded-xl border p-3.5 transition-all ${chipBg}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    {d.formattedDate} {d.isToday ? "· HOJE" : ""}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                      isLoss
                        ? "bg-negative/20 text-negative border border-negative/30"
                        : isPartial
                        ? "bg-warning/20 text-warning border border-warning/30"
                        : "bg-positive/20 text-positive border border-positive/30"
                    }`}
                  >
                    {isLoss
                      ? "⚠ Prejuízo"
                      : isPartial
                      ? "◑ Cobertura Parcial"
                      : "✓ Coberto"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gasto (anúncios)</span>
                    <span className="font-medium text-warning tabular-nums">
                      {brl(d.adSpend)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissão recebida</span>
                    <span
                      className={`font-medium tabular-nums ${
                        d.revenue > 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {brl(d.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dívida anterior</span>
                    <span className="font-medium text-negative tabular-nums">
                      {d.prevLoss > 0 ? brl(d.prevLoss) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Posição após dia</span>
                    <span
                      className={`tabular-nums ${
                        d.postLoss > 0 ? "text-negative" : "text-positive"
                      }`}
                    >
                      {d.postLoss > 0 ? `− ${brl(d.postLoss)}` : "✓ Zero"}
                    </span>
                  </div>
                </div>

                {totalDebt > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[0.65rem] text-muted-foreground mb-1">
                      <span>Cobertura</span>
                      <span>{Math.round(coveragePct)}% coberto</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          coveragePct >= 100
                            ? "bg-positive"
                            : coveragePct > 0
                            ? "bg-warning"
                            : "bg-negative"
                        }`}
                        style={{ width: `${coveragePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4 Cartões Sequenciais em Passos */}
      <div className="relative z-10 mt-6 rounded-xl border border-border/60 bg-surface/50 p-4">
        <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          📊 Rastreamento Detalhado (Matemática Exata)
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Passo 1: Prejuízo dos dias sem venda */}
          <div className="relative rounded-lg border border-negative/30 bg-negative/10 p-3.5">
            <div className="text-lg">🔴</div>
            <p className="mt-1 text-xs font-bold text-foreground">
              Prejuízo dos dias sem venda
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-0.5">
              {lossDayLabels ? `Dias: ${lossDayLabels}` : "Dias anteriores sem venda"}
            </p>
            <p className="mt-2 font-display text-lg font-bold text-negative tabular-nums">
              − {brl(totalPrevLoss)}
            </p>
          </div>

          {/* Passo 2: Comissão de hoje */}
          <div className="relative rounded-lg border border-positive/30 bg-positive/10 p-3.5">
            <div className="text-lg">💰</div>
            <p className="mt-1 text-xs font-bold text-foreground">
              Comissão de hoje
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-0.5">
              {todayUnits} venda{todayUnits !== 1 ? "s" : ""} → {brl(todayRevenue)} em comissão
            </p>
            <p className="mt-2 font-display text-lg font-bold text-positive tabular-nums">
              + {brl(todayRevenue)}
            </p>
          </div>

          {/* Passo 3: Restante dos dias anteriores */}
          <div className="relative rounded-lg border border-warning/30 bg-warning/10 p-3.5">
            <div className="text-lg">📉</div>
            <p className="mt-1 text-xs font-bold text-foreground">
              Restante dos dias anteriores
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-0.5">
              {remainingPastLoss > 0
                ? `${brl(totalPrevLoss)} − ${brl(todayRevenue)} = faltam ${brl(remainingPastLoss)}`
                : "Dívidas passadas zeradas!"}
            </p>
            <p
              className={`mt-2 font-display text-lg font-bold tabular-nums ${
                remainingPastLoss > 0 ? "text-warning" : "text-positive"
              }`}
            >
              {remainingPastLoss > 0 ? `− ${brl(remainingPastLoss)}` : "✓ Zero"}
            </p>
          </div>

          {/* Passo 4: Posição total descoberta hoje */}
          <div className="relative rounded-lg border border-negative/40 bg-negative/15 p-3.5">
            <div className="text-lg">⚠️</div>
            <p className="mt-1 text-xs font-bold text-foreground">
              Posição total descoberta hoje
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-0.5">
              {remainingPastLoss > 0
                ? `Faltam ${brl(remainingPastLoss)} do passado + ${brl(todayAdSpend)} de hoje`
                : totalUncovered > 0
                ? `Gasto de hoje (${brl(todayAdSpend)}) não coberto`
                : "Tudo 100% coberto!"}
            </p>
            <p
              className={`mt-2 font-display text-lg font-bold tabular-nums ${
                totalUncovered > 0 ? "text-negative" : "text-positive"
              }`}
            >
              {totalUncovered > 0 ? `− ${brl(totalUncovered)}` : "✓ Zero"}
            </p>
          </div>
        </div>
      </div>

      {/* Caixa de Veredicto */}
      <div className="relative z-10 mt-4">
        {totalUncovered === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-positive/30 bg-positive/10 p-4">
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Prejuízo e gastos totalmente cobertos!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                A comissão de hoje cobriu os prejuízos dos dias anteriores e o investimento em anúncios de hoje. Sua operação está no positivo!
              </p>
            </div>
          </div>
        ) : remainingPastLoss > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-negative/30 bg-negative/10 p-4">
            <span className="text-2xl">🔴</span>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Nem os dias anteriores foram 100% cobertos! Faltam centavos do passado + gasto de hoje.
              </h4>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>• Prejuízo acumulado dos dias sem venda ({lossDayLabels || "anteriores"}): <strong>{brl(totalPrevLoss)}</strong></p>
                <p>• Comissão de hoje: <strong>{brl(todayRevenue)}</strong> → Abateu {brl(coveredPastLoss)}, mas <span className="text-negative font-semibold">faltaram {brl(remainingPastLoss)}</span> para quitar o passado!</p>
                <p>• Gasto de anúncios hoje: <strong>{brl(todayAdSpend)}</strong> (ainda não coberto)</p>
                <p className="text-foreground font-semibold pt-0.5">• <strong>TOTAL NECESSÁRIO PARA ZERAR TUDO: <span className="text-negative font-bold">{brl(totalUncovered)}</span></strong></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Prejuízo anterior coberto, mas o gasto de hoje ainda está descoberto.
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                A comissão de hoje zerou a dívida dos dias passados ({lossDayLabels}). Porém, faltam <strong className="text-warning">− {brl(totalUncovered)}</strong> para cobrir o gasto com anúncios de hoje ({brl(todayAdSpend)}). A próxima venda resolve isso!
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
