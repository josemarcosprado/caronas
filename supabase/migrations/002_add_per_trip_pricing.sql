-- Migration: Adicionar modelo de precificação por trajeto
-- Execute no Supabase SQL Editor

-- 1. Criar enum para modelo de precificação
CREATE TYPE modelo_precificacao AS ENUM ('semanal', 'por_trajeto');

-- 2. Adicionar novas colunas na tabela grupos
ALTER TABLE grupos 
  ADD COLUMN IF NOT EXISTS modelo_precificacao modelo_precificacao DEFAULT 'semanal',
  ADD COLUMN IF NOT EXISTS valor_trajeto DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tempo_limite_cancelamento INTEGER DEFAULT 30; -- minutos antes do horário

-- 3. Criar tabela de transações financeiras
CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES membros(id) ON DELETE CASCADE,
    presenca_id UUID REFERENCES presencas(id) ON DELETE SET NULL,
    
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('debito', 'pagamento')),
    valor DECIMAL(10,2) NOT NULL,
    descricao TEXT,
    
    -- Para validação de comprovantes (PIX futuro)
    comprovante_url TEXT,
    comprovante_validado BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Indexes para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_membro ON transacoes(membro_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_grupo ON transacoes(grupo_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_presenca ON transacoes(presenca_id);

-- 5. View para saldo dos membros
CREATE OR REPLACE VIEW vw_saldo_membros AS
SELECT 
    m.id AS membro_id,
    m.nome,
    m.grupo_id,
    g.nome AS grupo_nome,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0) AS total_debitos,
    COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS total_pagamentos,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0) 
        - COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS saldo_devedor
FROM membros m
JOIN grupos g ON m.grupo_id = g.id
LEFT JOIN transacoes t ON m.id = t.membro_id
WHERE m.ativo = TRUE
GROUP BY m.id, m.nome, m.grupo_id, g.nome;

-- 6. Habilitar RLS na nova tabela
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

-- 7. Comentário para documentação
COMMENT ON TABLE transacoes IS 'Registra débitos (por trajeto) e pagamentos dos membros';
COMMENT ON COLUMN grupos.tempo_limite_cancelamento IS 'Minutos antes do horário que o membro pode cancelar sem débito';
