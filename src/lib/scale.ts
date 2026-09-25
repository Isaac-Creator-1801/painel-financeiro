import type { DayEntry, Ticket } from "./finance";

const SCALE_CONFIG_KEY = "op-financeiro:scale-config:v1";

export type ScaleConfig = {
  apiKey: string;
  storeId?: string;
  apiUrl?: string; // Default: https://api.scaletracking.com
  autoSync: boolean;
  webhookSecret?: string;
  lastSyncAt?: string;
};

export type ScaleDailyData = {
  date: string; // YYYY-MM-DD
  adSpend: number; // Custo com tráfego / anúncios
  revenue: number; // Faturamento bruto / liquidez
  salesCount: number; // Quantidade de vendas
  approvedCount?: number;
  refundsCount?: number;
  cpa?: number;
  roas?: number;
  salesByTicket?: Record<string, number>;
};

export function getScaleConfig(): ScaleConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCALE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScaleConfig;
    if (!parsed.apiKey && !parsed.webhookSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScaleConfig(config: ScaleConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCALE_CONFIG_KEY, JSON.stringify(config));
}

export function isScaleConfigured(): boolean {
  return getScaleConfig() !== null;
}

export function normalizeDateString(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim().split(" ")[0].replace(/["']/g, "");
  if (str.includes("-")) {
    const p = str.split("-");
    if (p.length === 3) {
      if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
      if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  if (str.includes("/")) {
    const p = str.split("/");
    if (p.length === 3) {
      let year = p[2].trim();
      if (year.length === 2) year = `20${year}`;
      return `${year}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  return "";
}

export function cleanNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const str = String(val).replace(/[R$\s]/g, "");
  let cleaned = str;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function cleanInteger(val: unknown): number {
  if (typeof val === "number") return Math.round(val);
  if (!val) return 0;
  const num = parseInt(String(val).replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Converte dados retornados da SkaleTracking em formato de DayEntry para a aplicação.
 */
export function mapScaleDataToDayEntry(
  scaleItem: ScaleDailyData,
  existingEntries: DayEntry[],
  tickets: Ticket[],
): DayEntry {
  const normDate = scaleItem.date;
  const existing = existingEntries.find((e) => e.date === normDate);

  const salesMap: Record<string, number> = existing?.sales ? { ...existing.sales } : {};

  if (scaleItem.salesByTicket && Object.keys(scaleItem.salesByTicket).length > 0) {
    for (const [ticketId, qty] of Object.entries(scaleItem.salesByTicket)) {
      salesMap[ticketId] = (salesMap[ticketId] ?? 0) + qty;
    }
  } else if (scaleItem.salesCount > 0 && tickets.length > 0) {
    const primaryTicket = tickets[0];
    if (primaryTicket) {
      salesMap[primaryTicket.id] = (salesMap[primaryTicket.id] ?? 0) + scaleItem.salesCount;
    }
  }

  return {
    id: existing?.id ?? crypto.randomUUID(),
    date: normDate,
    sales: salesMap,
    adSpend: scaleItem.adSpend ?? existing?.adSpend ?? 0,
    automationCost: existing?.automationCost ?? 0,
    creativeCost: existing?.creativeCost ?? 0,
    frustratedCost: existing?.frustratedCost ?? 0,
    otherCost: existing?.otherCost ?? 0,
    note: existing?.note ? existing.note : `Importado via Scale Tracking`,
  };
}

/**
 * Busca dados da API do Scale Tracking (se a chave estiver configurada).
 */
export async function fetchScaleMetrics(
  config: ScaleConfig,
  startDate?: string,
  endDate?: string,
): Promise<ScaleDailyData[]> {
  const baseUrl = (config.apiUrl || "https://api.scaletracking.com").replace(/\/+$/, "");
  
  try {
    const params = new URLSearchParams();
    if (config.storeId) params.append("store_id", config.storeId);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const url = `${baseUrl}/v1/analytics/daily?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-Scale-Token": config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Scale API HTTP status: ${res.status}`);
    }

    const json = await res.json();
    const dataList = Array.isArray(json) ? json : json.data || json.daily || [];

    return dataList.map((item: Record<string, unknown>) => {
      const date = normalizeDateString(item.date || item.day || new Date().toISOString());
      const adSpend = cleanNumber(item.ad_spend ?? item.cost ?? item.traffic_cost ?? item.investimento);
      const revenue = cleanNumber(item.revenue ?? item.sales_amount ?? item.gross ?? item.receita);
      const salesCount = cleanInteger(item.sales_count ?? item.orders ?? item.conversions ?? item.vendas);

      return {
        date,
        adSpend,
        revenue,
        salesCount,
        cpa: salesCount > 0 ? adSpend / salesCount : 0,
        roas: adSpend > 0 ? revenue / adSpend : 0,
      };
    });
  } catch (err) {
    console.warn("API direct call failed or restricted by CORS/Auth.", err);
    throw err;
  }
}

/**
 * Parser ultra-tolerante para qualquer tabela exportada (Excel .xlsx, TSV, CSV, JSON, texto colado).
 */
export function parseScaleExport(content: string): ScaleDailyData[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // 1. Tentar JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.data || parsed.rows || [parsed];
      return items.map((item: Record<string, unknown>) => ({
        date: normalizeDateString(item.date || item.data || item.day || item.dia),
        adSpend: cleanNumber(item.adSpend ?? item.ad_spend ?? item.cost ?? item.traffic_cost ?? item.gasto_trafego ?? item.investimento ?? item.anuncios),
        revenue: cleanNumber(item.revenue ?? item.receita ?? item.faturamento ?? item.sales_amount ?? item.liquido),
        salesCount: cleanInteger(item.salesCount ?? item.sales_count ?? item.vendas ?? item.orders ?? item.pedidos ?? item.conversao),
      })).filter((item) => Boolean(item.date));
    } catch {
      // Continuar para texto/tabela
    }
  }

  // 2. Tabela de linhas
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : firstLine.includes(",") ? "," : /\s{2,}/;

  const rawHeaders = typeof delimiter === "string" ? firstLine.toLowerCase().split(delimiter) : firstLine.toLowerCase().split(delimiter);
  const headers = rawHeaders.map((h) => h.replace(/["']/g, "").trim());

  let dateIdx = headers.findIndex((h) => h.includes("data") || h.includes("date") || h.includes("dia"));
  let spendIdx = headers.findIndex((h) => h.includes("gasto") || h.includes("anuncio") || h.includes("cost") || h.includes("spend") || h.includes("trafego") || h.includes("investimento") || h.includes("ad"));
  let revenueIdx = headers.findIndex((h) => h.includes("receita") || h.includes("fatura") || h.includes("revenue") || h.includes("vendas_bruta") || h.includes("liquido") || h.includes("total") || h.includes("bruto"));
  let salesIdx = headers.findIndex((h) => h.includes("qtd") || h.includes("vendas") || h.includes("orders") || h.includes("pedidos") || h.includes("conversao") || h.includes("venda"));

  let startLine = 1;
  // Se a primeira linha não contém nomes reconhecíveis de cabeçalhos, lê a partir da primeira linha
  if (dateIdx === -1 && spendIdx === -1 && salesIdx === -1) {
    startLine = 0;
    dateIdx = 0;
    spendIdx = 1;
    salesIdx = 2;
    revenueIdx = 3;
  }

  const results: ScaleDailyData[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const cols = typeof delimiter === "string" ? lines[i].split(delimiter) : lines[i].split(delimiter);
    if (!cols || !cols.length) continue;

    const rawDateStr = cols[dateIdx >= 0 ? dateIdx : 0] || "";
    const normDate = normalizeDateString(rawDateStr);
    if (!normDate) continue;

    const spend = spendIdx >= 0 && cols[spendIdx] !== undefined ? cleanNumber(cols[spendIdx]) : 0;
    const rev = revenueIdx >= 0 && cols[revenueIdx] !== undefined ? cleanNumber(cols[revenueIdx]) : 0;
    const sales = salesIdx >= 0 && cols[salesIdx] !== undefined ? cleanInteger(cols[salesIdx]) : 0;

    results.push({
      date: normDate,
      adSpend: spend,
      revenue: rev,
      salesCount: sales,
    });
  }

  return results;
}
