import { useState } from "react";
import {
  getScaleConfig,
  isScaleConfigured,
  mapScaleDataToDayEntry,
  parseScaleExport,
  saveScaleConfig,
  type ScaleConfig,
} from "@/lib/scale";
import type { DayEntry, Ticket } from "@/lib/finance";

type ScaleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: DayEntry[];
  tickets: Ticket[];
  onImportEntries: (newEntries: DayEntry[]) => void;
};

export function ScaleModal({
  isOpen,
  onClose,
  entries,
  tickets,
  onImportEntries,
}: ScaleModalProps) {
  const currentConfig = getScaleConfig();
  const [activeTab, setActiveTab] = useState<"api" | "import" | "webhook" | "mapping">("api");
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? "");
  const [storeId, setStoreId] = useState(currentConfig?.storeId ?? "");
  const [apiUrl, setApiUrl] = useState(currentConfig?.apiUrl ?? "https://api.scaletracking.com");
  const [autoSync, setAutoSync] = useState(currentConfig?.autoSync ?? true);
  const [importText, setImportText] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const basePath = typeof window !== "undefined"
    ? window.location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "")
    : "";

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}${basePath}/api/scale-webhook`
    : "https://seu-dominio.com/api/scale-webhook";

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const config: ScaleConfig = {
      apiKey: apiKey.trim(),
      storeId: storeId.trim(),
      apiUrl: apiUrl.trim(),
      autoSync,
      lastSyncAt: new Date().toISOString(),
    };
    saveScaleConfig(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleManualImport = () => {
    if (!importText.trim()) return;
    try {
      const items = parseScaleExport(importText);
      if (!items.length) {
        setImportSuccessMsg("⚠️ Nenhum dado válido encontrado no texto digitado.");
        return;
      }

      const updatedEntries = [...entries];
      let importedCount = 0;

      for (const item of items) {
        const mappedEntry = mapScaleDataToDayEntry(item, updatedEntries, tickets);
        const idx = updatedEntries.findIndex((e) => e.date === mappedEntry.date);
        if (idx !== -1) {
          updatedEntries[idx] = {
            ...updatedEntries[idx],
            adSpend: mappedEntry.adSpend || updatedEntries[idx].adSpend,
            sales: mappedEntry.sales,
          };
        } else {
          updatedEntries.push(mappedEntry);
        }
        importedCount++;
      }

      onImportEntries(updatedEntries);
      setImportSuccessMsg(`✓ ${importedCount} dia(s) importado(s) com sucesso da Scale Tracking!`);
      setImportText("");
      setTimeout(() => setImportSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setImportSuccessMsg("❌ Erro ao processar dados da Scale Tracking.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/20">
              ⚡
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Integração Scale Tracking
                {isScaleConfigured() && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                    Conectado
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Sincronize vendas, faturamento líquido e custo por tráfego automaticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm p-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="mt-4 flex gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("api")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "api"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            🔌 API / Credenciais
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "import"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            📥 Importar Relatório (CSV/JSON)
          </button>
          <button
            onClick={() => setActiveTab("webhook")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "webhook"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            🔗 Webhook Tempo Real
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="mt-4 space-y-4">
          {activeTab === "api" && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Chave de API / Token da Scale Tracking
                </label>
                <input
                  type="password"
                  placeholder="scale_live_sk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  Copie sua API Key no painel da Scale (Configurações &gt; API & Integções).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ID da Loja / Conta (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="minha-loja-123"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    URL da API Scale
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoSyncScale"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="autoSyncScale" className="text-xs text-foreground font-medium">
                  Sincronizar gastos de tráfego e vendas automaticamente no fundo
                </label>
              </div>

              {savedSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center font-medium">
                  ✓ Configuração da Scale Tracking salva com sucesso!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                  Salvar Integração
                </button>
              </div>
            </form>
          )}

          {activeTab === "import" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Cole aqui o relatório exportado (JSON ou CSV) da Scale Tracking com seus dados de tráfego (adSpend) e vendas para sincronizar múltiplos dias de uma vez.
              </p>
              <div>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Cole o JSON ou CSV exportado da Scale aqui...\nExemplo JSON:\n[\n  { "date": "2026-09-25", "ad_spend": 350.00, "sales_count": 5, "revenue": 1485.00 }\n]`}
                  className="w-full rounded-lg border border-border bg-background p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {importSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs text-center font-medium">
                  {importSuccessMsg}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleManualImport}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
                >
                  Processar e Sincronizar Lançamentos
                </button>
              </div>
            </div>
          )}

          {activeTab === "webhook" && (
            <div className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Você pode receber dados de vendas e custo por tráfego em tempo real configurando este Webhook no painel da Scale Tracking.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  URL de Webhook do seu site:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-primary"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 whitespace-nowrap"
                  >
                    {copied ? "Copiar ✓" : "Copiar URL"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-surface-2 p-3 border border-border">
                <p className="font-semibold text-foreground mb-1">Campos Suportados pelo Webhook:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 font-mono text-[0.75rem]">
                  <li><span className="text-primary">date</span> (Ex: "2026-09-25")</li>
                  <li><span className="text-primary">ad_spend</span> ou <span className="text-primary">gasto_trafego</span> (Custo total de anúncios no dia)</li>
                  <li><span className="text-primary">revenue</span> ou <span className="text-primary">faturamento</span> (Receita líquida obtida)</li>
                  <li><span className="text-primary">sales_count</span> ou <span className="text-primary">vendas</span> (Quantidade de vendas no dia)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
