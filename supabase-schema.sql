-- Script de Criação do Banco de Dados para o Supabase (Controle Financeiro)
-- Execute este script no Dashboard do Supabase -> SQL Editor -> New query -> Run

-- 1. Tabela de Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    net NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Lançamentos (entries - compatível com index.html)
CREATE TABLE IF NOT EXISTS public.entries (
    id TEXT PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    sales JSONB NOT NULL DEFAULT '{}'::jsonb,
    "adSpend" NUMERIC DEFAULT 0,
    "automationCost" NUMERIC DEFAULT 0,
    "creativeCost" NUMERIC DEFAULT 0,
    "frustratedCost" NUMERIC DEFAULT 0,
    "otherCost" NUMERIC DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Lançamentos Diários (day_entries - alias/alternativa)
CREATE TABLE IF NOT EXISTS public.day_entries (
    id TEXT PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    sales JSONB NOT NULL DEFAULT '{}'::jsonb,
    ad_spend NUMERIC DEFAULT 0,
    automation_cost NUMERIC DEFAULT 0,
    creative_cost NUMERIC DEFAULT 0,
    frustrated_cost NUMERIC DEFAULT 0,
    other_cost NUMERIC DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar RLS (Row Level Security) e Políticas de Acesso Total
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso sem restrição (para operação anônima pública)
DROP POLICY IF EXISTS "Permitir tudo em tickets" ON public.tickets;
CREATE POLICY "Permitir tudo em tickets" ON public.tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em entries" ON public.entries;
CREATE POLICY "Permitir tudo em entries" ON public.entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em day_entries" ON public.day_entries;
CREATE POLICY "Permitir tudo em day_entries" ON public.day_entries FOR ALL USING (true) WITH CHECK (true);

-- 5. Habilitar Realtime para atualização instantânea em dispositivos
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_entries;
