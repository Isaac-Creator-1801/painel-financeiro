export type Ticket = {
  id: string;
  label: string;
  price: number;
  net: number; // valor que você recebe por venda (R$)
};

export type DayEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  sales: Record<string, number>;
  adSpend: number;
  automationCost: number;
  creativeCost: number;
  frustratedCost: number;
  otherCost: number;
  note?: string;
};

export const DEFAULT_TICKETS: Ticket[] = [
  { id: "t247", label: "R$ 247", price: 247, net: 128 },
  { id: "t297", label: "R$ 297", price: 297, net: 154 },
  { id: "t347", label: "R$ 347", price: 347, net: 180 },
  { id: "t397", label: "R$ 397", price: 397, net: 206 },
];

const KEY_TICKETS = "op-financeiro:tickets:v2";
const KEY_ENTRIES = "op-financeiro:entries:v1";

export function loadTickets(): Ticket[] {
  if (typeof window === "undefined") return DEFAULT_TICKETS;
  try {
    const raw = window.localStorage.getItem(KEY_TICKETS);
    if (!raw) return DEFAULT_TICKETS;
    const parsed = JSON.parse(raw) as (Ticket & { commission?: number })[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TICKETS;
    return parsed.map((t) => ({
      id: t.id,
      label: t.label,
      price: n(t.price),
      net: n(t.net) || n(t.price) * (t.commission ?? 0.55),
    }));
  } catch {
    return DEFAULT_TICKETS;
  }
}


export function saveTickets(tickets: Ticket[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_TICKETS, JSON.stringify(tickets));
}

export function loadEntries(): DayEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DayEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: DayEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries));
}

export function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.trim();
  if (clean.includes("-")) {
    return clean.slice(0, 10);
  }
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }
  return clean;
}

export function getLocalDateString(dateObj = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyEntry(date = getLocalDateString()): DayEntry {
  return {
    id: crypto.randomUUID(),
    date,
    sales: {},
    adSpend: 0,
    automationCost: 0,
    creativeCost: 0,
    frustratedCost: 0,
    otherCost: 0,
  };
}

/**
 * O campo `adSpend` guarda o valor ACUMULADO da fatura de anúncios do mês.
 * Estas funções convertem isso no gasto real de cada dia (diferença em relação
 * ao dia anterior do mesmo mês).
 */
export function dailyAdSpend(entries: DayEntry[]): DayEntry[] {
  const byMonth = new Map<string, DayEntry[]>();
  for (const e of entries) {
    const k = monthKey(e.date);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }
  const out: DayEntry[] = [];
  for (const list of byMonth.values()) {
    const sorted = [...list].sort((a, b) =>
      normalizeDate(a.date).localeCompare(normalizeDate(b.date)),
    );
    let prev = 0;
    for (const e of sorted) {
      const invoice = n(e.adSpend);
      out.push({ ...e, adSpend: Math.max(0, invoice - prev) });
      prev = Math.max(prev, invoice);
    }
  }
  return out;
}

/** Fatura acumulada registrada antes de `date` (mesmo mês), ignorando `ignoreId`. */
export function previousInvoice(entries: DayEntry[], date: string, ignoreId?: string): number {
  const targetNorm = normalizeDate(date);
  const targetMonth = monthKey(date);
  return entries
    .filter(
      (e) =>
        e.id !== ignoreId &&
        monthKey(e.date) === targetMonth &&
        normalizeDate(e.date) < targetNorm,
    )
    .reduce((max, e) => Math.max(max, n(e.adSpend)), 0);
}

export type EntryMetrics = {
  units: number;
  gross: number;
  revenue: number;
  costs: number;
  profit: number;
  roas: number;
  margin: number;
  cpa: number;
};

export function entryMetrics(entry: DayEntry, tickets: Ticket[]): EntryMetrics {
  let units = 0;
  let gross = 0;
  let revenue = 0;
  for (const t of tickets) {
    const q = Number(entry.sales[t.id] ?? 0);
    if (!q) continue;
    units += q;
    gross += q * t.price;
    revenue += q * t.net;
  }
  const totalCosts =
    n(entry.adSpend) +
    n(entry.automationCost) +
    n(entry.creativeCost) +
    n(entry.frustratedCost) +
    n(entry.otherCost);

  // Zappcash (automationCost) e Criativos (creativeCost) NÃO reduzem o lucro líquido do dia
  const directCosts = n(entry.adSpend) + n(entry.frustratedCost) + n(entry.otherCost);
  const profit = revenue - directCosts;

  return {
    units,
    gross,
    revenue,
    costs: totalCosts,
    profit,
    roas: n(entry.adSpend) > 0 ? revenue / n(entry.adSpend) : 0,
    margin: revenue > 0 ? profit / revenue : 0,
    cpa: units > 0 ? n(entry.adSpend) / units : 0,
  };
}

export function sumMetrics(entries: DayEntry[], tickets: Ticket[]): EntryMetrics {
  const totals = entries.reduce(
    (acc, e) => {
      const m = entryMetrics(e, tickets);
      acc.units += m.units;
      acc.gross += m.gross;
      acc.revenue += m.revenue;
      acc.costs += m.costs;
      acc.directCosts += n(e.adSpend) + n(e.frustratedCost) + n(e.otherCost);
      acc.ads += n(e.adSpend);
      return acc;
    },
    { units: 0, gross: 0, revenue: 0, costs: 0, directCosts: 0, ads: 0 },
  );
  const profit = totals.revenue - totals.directCosts;
  return {
    units: totals.units,
    gross: totals.gross,
    revenue: totals.revenue,
    costs: totals.costs,
    profit,
    roas: totals.ads > 0 ? totals.revenue / totals.ads : 0,
    margin: totals.revenue > 0 ? profit / totals.revenue : 0,
    cpa: totals.units > 0 ? totals.ads / totals.units : 0,
  };
}

export function costBreakdown(entries: DayEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      adSpend: acc.adSpend + n(e.adSpend),
      automationCost: acc.automationCost + n(e.automationCost),
      creativeCost: acc.creativeCost + n(e.creativeCost),
      frustratedCost: acc.frustratedCost + n(e.frustratedCost),
      otherCost: acc.otherCost + n(e.otherCost),
    }),
    { adSpend: 0, automationCost: 0, creativeCost: 0, frustratedCost: 0, otherCost: 0 },
  );
}

export function n(v: unknown): number {
  const num = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function formatDate(date: string) {
  const norm = normalizeDate(date);
  if (!norm || !norm.includes("-")) return date;
  const [y, m, d] = norm.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

export function formatDisplayDate(date: string) {
  return formatDate(date);
}

export function parseDisplayDate(value: string): string | null {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length !== 6) return null;
  const d = cleaned.slice(0, 2);
  const m = cleaned.slice(2, 4);
  const y = `20${cleaned.slice(4, 6)}`;
  const candidate = new Date(`${y}-${m}-${d}T12:00:00`);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== Number(y) ||
    candidate.getMonth() + 1 !== Number(m) ||
    candidate.getDate() !== Number(d)
  ) return null;
  return `${y}-${m}-${d}`;
}

export function monthKey(date: string) {
  const norm = normalizeDate(date);
  return norm.slice(0, 7);
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const names = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${names[Number(m) - 1] ?? m} / ${y}`;
}

export function toCsv(entries: DayEntry[], tickets: Ticket[]) {
  const head = [
    "Data",
    ...tickets.map((t) => `Vendas ${t.label}`),
    "Faturamento bruto",
    "Comissao liquida",
    "Anuncios",
    "Automacao",
    "Criativos",
    "Pedidos frustrados",
    "Outros",
    "Custo total",
    "Lucro",
    "ROAS",
  ];
  const rows = entries.map((e) => {
    const m = entryMetrics(e, tickets);
    return [
      e.date,
      ...tickets.map((t) => e.sales[t.id] ?? 0),
      m.gross.toFixed(2),
      m.revenue.toFixed(2),
      n(e.adSpend).toFixed(2),
      n(e.automationCost).toFixed(2),
      n(e.creativeCost).toFixed(2),
      n(e.frustratedCost).toFixed(2),
      n(e.otherCost).toFixed(2),
      m.costs.toFixed(2),
      m.profit.toFixed(2),
      m.roas.toFixed(2),
    ];
  });
  return [head, ...rows].map((r) => r.join(";")).join("\n");
}

export type DayLossDetail = {
  date: string;
  formattedDate: string;
  adSpend: number;
  revenue: number;
  profit: number;
  prevLoss: number;
  postLoss: number;
  coveredLoss: number;
  isToday: boolean;
  type: "loss" | "partial" | "covered" | "profit";
};

export type LossTrackerData = {
  lossDays: DayLossDetail[];
  totalPrevLoss: number;
  todayEntry: DayEntry | null;
  todayDateFormatted: string;
  isRealToday: boolean;
  todayRevenue: number;
  todayAdSpend: number;
  todayUnits: number;
  coveredPastLoss: number;
  remainingPastLoss: number;
  todayUncoveredAdSpend: number;
  totalUncovered: number;
  lossDayLabels: string;
};

export function calculateLossTracker(
  entries: DayEntry[],
  tickets: Ticket[],
): LossTrackerData {
  if (!entries.length) {
    return {
      lossDays: [],
      totalPrevLoss: 0,
      todayEntry: null,
      todayDateFormatted: "",
      isRealToday: false,
      todayRevenue: 0,
      todayAdSpend: 0,
      todayUnits: 0,
      coveredPastLoss: 0,
      remainingPastLoss: 0,
      todayUncoveredAdSpend: 0,
      totalUncovered: 0,
      lossDayLabels: "",
    };
  }

  // Ordenar cronologicamente por data ISO normalizada (do mais antigo ao mais recente)
  const sorted = [...entries].sort((a, b) =>
    normalizeDate(a.date).localeCompare(normalizeDate(b.date)),
  );
  const todayStr = getLocalDateString();

  // Encontrar o último dia que possui lançamentos reais (vendas ou anúncios)
  const lastActiveEntry =
    [...sorted]
      .reverse()
      .find((e) => entryMetrics(e, tickets).units > 0 || n(e.adSpend) > 0) ??
    sorted[sorted.length - 1];

  const todayEntry =
    sorted.find((e) => normalizeDate(e.date) === todayStr) ?? lastActiveEntry;
  const isRealToday = todayEntry ? normalizeDate(todayEntry.date) === todayStr : false;

  // Se hoje for o dia real mas não tiver lançamentos (0 vendas e 0 anúncios), usa o último dia ativo
  const refEntry =
    isRealToday &&
    (entryMetrics(todayEntry, tickets).units > 0 || n(todayEntry.adSpend) > 0)
      ? todayEntry
      : lastActiveEntry;
  const todayDateFormatted = refEntry ? formatDate(refEntry.date) : "";

  let runningDebt = 0;
  let activeUncoveredLossDates: string[] = [];

  const processedDays: DayLossDetail[] = [];
  let refPrevLoss = 0;
  let refCoveredLoss = 0;

  for (const entry of sorted) {
    const isToday = entry.id === refEntry.id;
    const m = entryMetrics(entry, tickets);
    const adSpend = n(entry.adSpend);
    const prevLoss = runningDebt;
    const formattedDate = formatDate(entry.date);

    let type: "loss" | "partial" | "covered" | "profit" = "profit";
    let coveredLoss = 0;

    if (m.units === 0 && adSpend > 0) {
      // Dia sem venda com gasto de anúncio
      runningDebt += adSpend;
      type = "loss";
      if (!activeUncoveredLossDates.includes(formattedDate)) {
        activeUncoveredLossDates.push(formattedDate);
      }
    } else if (m.revenue > 0) {
      if (prevLoss > 0) {
        coveredLoss = Math.min(m.revenue, prevLoss);
        const debtAfterCovering = prevLoss - coveredLoss;
        const surplusRevenue = m.revenue - coveredLoss;
        const uncoveredTodayAds = Math.max(0, adSpend - surplusRevenue);

        runningDebt = debtAfterCovering + uncoveredTodayAds;

        if (debtAfterCovering === 0) {
          activeUncoveredLossDates = [];
          if (uncoveredTodayAds > 0) {
            type = "partial";
          } else {
            type = "covered";
          }
        } else {
          type = "partial";
        }
      } else {
        if (adSpend > m.revenue) {
          runningDebt = adSpend - m.revenue;
          type = "partial";
        } else {
          runningDebt = 0;
          type = "profit";
        }
      }
    } else {
      // 0 vendas e 0 adSpend
      type = runningDebt > 0 ? "partial" : "profit";
    }

    if (isToday) {
      refPrevLoss = prevLoss;
      refCoveredLoss = coveredLoss;
    }

    processedDays.push({
      date: entry.date,
      formattedDate,
      adSpend,
      revenue: m.revenue,
      profit: m.profit,
      prevLoss,
      postLoss: runningDebt,
      coveredLoss,
      isToday,
      type,
    });
  }

  const refMetrics = refEntry
    ? entryMetrics(refEntry, tickets)
    : { revenue: 0, units: 0, profit: 0, costs: 0, gross: 0, margin: 0, roas: 0, cpa: 0 };

  const totalPrevLoss = refPrevLoss;
  const todayRevenue = refMetrics.revenue;
  const todayAdSpend = n(refEntry?.adSpend ?? 0);
  const todayUnits = refMetrics.units;

  const coveredPastLoss = Math.min(todayRevenue, totalPrevLoss);
  const remainingPastLoss = Math.max(0, totalPrevLoss - coveredPastLoss);
  const extraRevenueAfterPast = Math.max(0, todayRevenue - totalPrevLoss);
  const todayUncoveredAdSpend = Math.max(0, todayAdSpend - extraRevenueAfterPast);
  const totalUncovered = runningDebt;

  const lossDayLabels = activeUncoveredLossDates.join(" + ");

  return {
    lossDays: processedDays.filter((d) => d.type === "loss" || d.type === "partial" || d.isToday).slice(-5),
    totalPrevLoss,
    todayEntry: refEntry,
    todayDateFormatted,
    isRealToday: refEntry?.id === todayEntry?.id && isRealToday,
    todayRevenue,
    todayAdSpend,
    todayUnits,
    coveredPastLoss,
    remainingPastLoss,
    todayUncoveredAdSpend,
    totalUncovered,
    lossDayLabels,
  };
}
