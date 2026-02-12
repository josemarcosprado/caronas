-- Migration 010: Create usuarios table and separate user identity from group membership
-- This migration decouples user accounts from group participation.

-- ============================================================
-- 1. Create usuarios table (user identity / auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    senha_hash VARCHAR(255),
    cnh_url TEXT,
    matricula VARCHAR(50) NOT NULL,
    matricula_status VARCHAR(20) DEFAULT 'pendente'
        CHECK (matricula_status IN ('pendente', 'aprovado', 'rejeitado')),
    cnh_status VARCHAR(20) DEFAULT 'nao_enviada'
        CHECK (cnh_status IN ('nao_enviada', 'pendente', 'aprovado', 'rejeitado')),
    pode_ser_motorista BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON usuarios(telefone);

-- ============================================================
-- 2. Migrate existing data from membros → usuarios
-- ============================================================
-- For each unique phone, take the most relevant record (prefer motorista)
INSERT INTO usuarios (nome, telefone, senha_hash, cnh_url, matricula, matricula_status, cnh_status, pode_ser_motorista)
SELECT DISTINCT ON (telefone)
    nome,
    telefone,
    senha_hash,
    cnh_url,
    COALESCE(matricula, ''),
    CASE WHEN matricula IS NOT NULL AND matricula != '' THEN 'pendente' ELSE 'pendente' END,
    CASE WHEN cnh_url IS NOT NULL THEN 'pendente' ELSE 'nao_enviada' END,
    is_motorista
FROM membros
ORDER BY telefone, is_motorista DESC, created_at ASC
ON CONFLICT (telefone) DO NOTHING;

-- ============================================================
-- 3. Add usuario_id FK to membros
-- ============================================================
ALTER TABLE membros ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);

-- Populate usuario_id based on matching telefone
UPDATE membros m
SET usuario_id = u.id
FROM usuarios u
WHERE m.telefone = u.telefone;

-- ============================================================
-- 4. Update grupos.motorista_id to reference usuarios instead of membros
-- ============================================================
-- First, map old motorista_id (membros.id) → usuarios.id
-- We need to do this before changing the FK
ALTER TABLE grupos DROP CONSTRAINT IF EXISTS fk_motorista;

UPDATE grupos g
SET motorista_id = u.id
FROM membros m
JOIN usuarios u ON m.telefone = u.telefone
WHERE m.id = g.motorista_id;

ALTER TABLE grupos ADD CONSTRAINT fk_motorista
    FOREIGN KEY (motorista_id) REFERENCES usuarios(id);

-- ============================================================
-- 5. Clean up identity columns from membros (now in usuarios)
-- ============================================================
-- Drop columns that are now in usuarios
ALTER TABLE membros DROP COLUMN IF EXISTS senha_hash;
ALTER TABLE membros DROP COLUMN IF EXISTS cnh_url;

-- Keep these for now (bot compatibility), but they're denormalized:
-- nome, telefone, matricula — will be read from usuarios in queries

-- Drop the old unique constraint on (grupo_id, telefone) and make (grupo_id, usuario_id) unique
ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_grupo_telefone_key;
ALTER TABLE membros ADD CONSTRAINT membros_grupo_usuario_key UNIQUE (grupo_id, usuario_id);

-- Drop old single-driver-per-phone index, replace with single-driver-per-user
DROP INDEX IF EXISTS idx_single_driver_per_phone;
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_driver_per_user
ON membros (usuario_id)
WHERE is_motorista = TRUE;

-- ============================================================
-- 6. RLS policies for usuarios
-- ============================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de usuarios"
    ON usuarios FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir inserção pública de usuarios"
    ON usuarios FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização de usuarios"
    ON usuarios FOR UPDATE TO anon, authenticated USING (true);

-- ============================================================
-- 7. Update vw_saldo_membros to JOIN with usuarios
-- ============================================================
CREATE OR REPLACE VIEW vw_saldo_membros AS
SELECT
    m.id AS membro_id,
    COALESCE(u.nome, m.nome) AS nome,
    m.grupo_id,
    g.nome AS grupo_nome,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0) AS total_debitos,
    COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS total_pagamentos,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS saldo_devedor
FROM membros m
JOIN grupos g ON m.grupo_id = g.id
LEFT JOIN usuarios u ON m.usuario_id = u.id
LEFT JOIN transacoes t ON m.id = t.membro_id
WHERE m.ativo = TRUE
GROUP BY m.id, u.nome, m.nome, m.grupo_id, g.nome;
