-- Migration 011: Remove denormalized identity columns from membros
-- State: migration 010 already applied (usuarios table exists, membros still has nome/telefone/whatsapp_id/matricula)

-- ============================================================
-- 1. Add whatsapp_id to usuarios (user-level, not group-level)
-- ============================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS whatsapp_id VARCHAR(100);

-- Migrate whatsapp_id data from membros to usuarios
-- For each usuario, take the first non-null whatsapp_id from their membros
UPDATE usuarios u
SET whatsapp_id = sub.whatsapp_id
FROM (
    SELECT DISTINCT ON (m.usuario_id) m.usuario_id, m.whatsapp_id
    FROM membros m
    WHERE m.usuario_id IS NOT NULL
      AND m.whatsapp_id IS NOT NULL
    ORDER BY m.usuario_id, m.updated_at DESC
) sub
WHERE u.id = sub.usuario_id
  AND u.whatsapp_id IS NULL;

-- ============================================================
-- 2. Recreate views FIRST (remove dependency on membros.nome)
-- ============================================================

-- vw_saldo_membros: nome now comes from usuarios only
CREATE OR REPLACE VIEW vw_saldo_membros AS
SELECT
    m.id AS membro_id,
    u.nome,
    m.grupo_id,
    g.nome AS grupo_nome,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0) AS total_debitos,
    COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS total_pagamentos,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' THEN t.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN t.tipo = 'pagamento' THEN t.valor ELSE 0 END), 0) AS saldo_devedor
FROM membros m
JOIN usuarios u ON m.usuario_id = u.id
JOIN grupos g ON m.grupo_id = g.id
LEFT JOIN transacoes t ON m.id = t.membro_id
WHERE m.ativo = TRUE
GROUP BY m.id, u.nome, m.grupo_id, g.nome;

-- vw_status_semana: membro_nome now comes from usuarios
CREATE OR REPLACE VIEW vw_status_semana AS
SELECT
    v.id AS viagem_id,
    v.data,
    v.tipo,
    v.horario_partida,
    v.status AS status_viagem,
    v.grupo_id,
    m.id AS membro_id,
    u.nome AS membro_nome,
    p.status AS status_presenca,
    p.horario_atraso,
    p.observacao,
    g.valor_semanal,
    g.nome AS grupo_nome
FROM viagens v
JOIN grupos g ON v.grupo_id = g.id
LEFT JOIN presencas p ON v.id = p.viagem_id
LEFT JOIN membros m ON p.membro_id = m.id
LEFT JOIN usuarios u ON m.usuario_id = u.id
WHERE v.data >= DATE_TRUNC('week', CURRENT_DATE)
  AND v.data < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days';

-- ============================================================
-- 3. NOW drop denormalized columns (views no longer depend on them)
-- ============================================================
ALTER TABLE membros DROP COLUMN IF EXISTS nome;
ALTER TABLE membros DROP COLUMN IF EXISTS telefone;
ALTER TABLE membros DROP COLUMN IF EXISTS whatsapp_id;
ALTER TABLE membros DROP COLUMN IF EXISTS matricula;
