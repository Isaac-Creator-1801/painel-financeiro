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

/**
 * Converte dados retornados da Scale Tracking em formato de DayEntry para a aplicação.
 */
export function mapScaleDataToDayEntry(
  scaleItem: ScaleDailyData,
  existingEntries: DayEntry[],
  tickets: Ticket[],
): DayEntry {
  const normDate = scaleItem.date;
  const existing = existingEntries.find((e) => e.date === normDate);

  // Mapear vendas para os tickets existentes do sistema
  const salesMap: Record<string, number> = existing?.sales ? { ...existing.sales } : {};

  if (scaleItem.salesByTicket && Object.keys(scaleItem.salesByTicket).length > 0) {
    for (const [ticketId, qty] of Object.entries(scaleItem.salesByTicket)) {
      salesMap[ticketId] = (salesMap[ticketId] ?? 0) + qty;
    }
  } else if (scaleItem.salesCount > 0 && tickets.length > 0) {
    // Se a Scale deu apenas contagem total de vendas sem dividir ticket, distribui no ticket principal/default ou primeiro ticket
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
    note: existing?.note ? `${existing.note} | [Scale Sync]` : `Importado via Scale Tracking`,
  };
}

/**
 * Busca dados da API do Scale Tracking (se a chave estivar configurada).
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
      const date = String(item.date || item.day || new Date().toISOString().split("T")[0]);
      const adSpend = Number(item.ad_spend ?? item.cost ?? item.traffic_cost ?? 0);
      const revenue = Number(item.revenue ?? item.sales_amount ?? item.gross ?? 0);
      const salesCount = Number(item.sales_count ?? item.orders ?? item.conversions ?? 0);

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
    console.warn("API direct call failed or restricted by CORS/Auth. Returning mock format or fallback.", err);
    throw err;
  }
}

/**
 * Parser para importação manual de dados exportados da Scale Tracking (JSON ou CSV).
 */
export function parseScaleExport(content: string): ScaleDailyData[] {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // JSON Payload
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.data || parsed.rows || [parsed];
      return items.map((item: Record<string, unknown>) => ({
        date: String(item.date || item.data || item.day || new Date().toISOString().split("T")[0]),
        adSpend: Number(item.adSpend ?? item.ad_spend ?? item.cost ?? item.traffic_cost ?? item.gasto_trafego ?? 0),
        revenue: Number(item.revenue ?? item.receita ?? item.faturamento ?? item.sales_amount ?? 0),
        salesCount: Number(item.salesCount ?? item.sales_count ?? item.vendas ?? item.orders ?? 0),
      }));
    } catch (e) {
      console.error("Erro no parse JSON da Scale:", e);
    }
  }

  // CSV Fallback
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(/[;,]/);
  const dateIdx = headers.findIndex((h) => h.includes("data") || h.includes("date") || h.includes("dia"));
  const spendIdx = headers.findIndex((h) => h.includes("gasto") || h.includes("anuncio") || h.includes("cost") || h.includes("spend") || h.includes("trafego"));
  const revenueIdx = headers.findIndex((h) => h.includes("receita") || h.includes("fatura") || h.includes("revenue") || h.includes("vendas_bruta"));
  const salesIdx = headers.findIndex((h) => h.includes("qtd") || h.includes("vendas") || h.includes("orders") || h.includes("pedidos"));

  const results: ScaleDailyData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/);
    if (!cols[dateIdx]) continue;

    const rawDate = cols[dateIdx].replace(/["']/g, "").trim();
    let normDate = rawDate;
    if (rawDate.includes("/")) {
      const p = rawDate.split("/");
      if (p.length === 3) normDate = `${p[2].length === 2 ? "20" + p[2] : p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }

    const spend = spendIdx !== -1 ? parseFloat(cols[spendIdx].replace("R$", "").replace(",", ".").trim()) || 0 : 0;
    const rev = revenueIdx !== -1 ? parseFloat(cols[revenueIdx].replace("R$", "").replace(",", ".").trim()) || 0 : 0;
    const sales = salesIdx !== -1 ? parseInt(cols[salesIdx].trim(), 10) || 0 : 0;

    results.push({
      date: normDate,
      adSpend: spend,
      revenue: rev,
      salesCount: sales,
    });
  }

  return results;
}
