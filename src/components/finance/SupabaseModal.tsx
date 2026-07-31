import { useState } from "react";
import { getSupabaseConfig, saveSupabaseConfig, type SupabaseConfig } from "@/lib/supabase";

type SupabaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function SupabaseModal({ isOpen, onClose, onSaved }: SupabaseModalProps) {
  const current = getSupabaseConfig();
  const [url, setUrl] = useState(current?.url ?? "");
  const [anonKey, setAnonKey] = useState(current?.anonKey ?? "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !anonKey) return;
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSaved();
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl text-card-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>⚡ Configuração Supabase</span>
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              URL do Projeto Supabase
            </label>
            <input
              type="text"
              placeholder="https://sua-id.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              Encontrado no painel Supabase em Settings &gt; API.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Chave Anon (public)
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
              required
            />
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              Sua chave anônima pública do Supabase.
            </p>
          </div>

          {savedSuccess && (
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium">
              ✓ Configuração salva com sucesso! Sincronizando...
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar Conexão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
