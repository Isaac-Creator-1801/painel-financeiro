import type { DayEntry, Ticket } from "./finance";

const CONFIG_KEY = "op-financeiro:supabase-config:v1";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

function extractUrlFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload && payload.ref) {
      return `https://${payload.ref}.supabase.co`;
    }
  } catch {
    // fallback
  }
  return null;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
  let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SupabaseConfig;
        if (parsed.url) url = parsed.url;
        if (parsed.anonKey) anonKey = parsed.anonKey;
      }
    } catch {
      // fallback para env
    }
  }

  if (!url && anonKey) {
    url = extractUrlFromJwt(anonKey) || "";
  }

  if (!url || !anonKey) return null;

  // Remover barra no final se houver
  url = url.replace(/\/+$/, "");
  return { url, anonKey };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function getHeaders(config: SupabaseConfig) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    "Content-Type": "application/json",
  };
}

// ---------------- TICKETS ----------------

export async function fetchTicketsFromSupabase(): Promise<Ticket[] | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/rest/v1/tickets?select=*`, {
      headers: getHeaders(config),
    });
    if (!res.ok) {
      console.error("Erro ao buscar tickets do Supabase:", await res.text());
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    return data.map((t: Record<string, unknown>) => ({
      id: String(t.id),
      label: String(t.label),
      price: Number(t.price ?? 0),
      net: Number(t.net ?? 0),
    }));
  } catch (err) {
    console.error("Erro de conexão com Supabase:", err);
    return null;
  }
}

export async function saveTicketsToSupabase(tickets: Ticket[]): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  try {
    const payload = tickets.map((t) => ({
      id: t.id,
      label: t.label,
      price: t.price,
      net: t.net,
    }));

    const res = await fetch(`${config.url}/rest/v1/tickets`, {
      method: "POST",
      headers: {
        ...getHeaders(config),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Erro ao salvar tickets no Supabase:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao salvar tickets no Supabase:", err);
    return false;
  }
}

// ---------------- DAY ENTRIES ----------------

export async function fetchEntriesFromSupabase(): Promise<DayEntry[] | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    let res = await fetch(`${config.url}/rest/v1/entries?select=*&order=date.desc`, {
      headers: getHeaders(config),
    });
    if (!res.ok) {
      res = await fetch(`${config.url}/rest/v1/day_entries?select=*&order=date.desc`, {
        headers: getHeaders(config),
      });
    }
    if (!res.ok) {
      console.error("Erro ao buscar entradas do Supabase:", await res.text());
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    return data.map((e: Record<string, unknown>) => ({
      id: String(e.id),
      date: String(e.date),
      sales: typeof e.sales === "object" && e.sales !== null ? (e.sales as Record<string, number>) : {},
      adSpend: Number(e.adSpend ?? e.ad_spend ?? 0),
      automationCost: Number(e.automationCost ?? e.automation_cost ?? 0),
      creativeCost: Number(e.creativeCost ?? e.creative_cost ?? 0),
      frustratedCost: Number(e.frustratedCost ?? e.frustrated_cost ?? 0),
      otherCost: Number(e.otherCost ?? e.other_cost ?? 0),
      note: e.note ? String(e.note) : undefined,
    }));
  } catch (err) {
    console.error("Erro de conexão com Supabase ao buscar entradas:", err);
    return null;
  }
}

export async function saveEntryToSupabase(entry: DayEntry): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  try {
    const payload = {
      id: entry.id,
      date: entry.date,
      sales: entry.sales,
      adSpend: entry.adSpend,
      automationCost: entry.automationCost,
      creativeCost: entry.creativeCost,
      frustratedCost: entry.frustratedCost,
      otherCost: entry.otherCost,
      note: entry.note || null,
    };

    const res = await fetch(`${config.url}/rest/v1/entries`, {
      method: "POST",
      headers: {
        ...getHeaders(config),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Erro ao salvar entrada no Supabase:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro de rede ao salvar entrada no Supabase:", err);
    return false;
  }
}

export async function deleteEntryFromSupabase(id: string): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  try {
    const res = await fetch(`${config.url}/rest/v1/entries?id=eq.${id}`, {
      method: "DELETE",
      headers: getHeaders(config),
    });
    return res.ok;
  } catch (err) {
    console.error("Erro ao excluir entrada do Supabase:", err);
    return false;
  }
}
