-- Migração: Adicionar verificação por CNH para motoristas
-- Execute este script no Supabase SQL Editor

-- Adicionar campo para URL da foto da CNH
ALTER TABLE membros ADD COLUMN IF NOT EXISTS cnh_url TEXT;

-- Adicionar campo para status de aprovação
-- 'aprovado' como default para não quebrar motoristas existentes
ALTER TABLE membros ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(20) DEFAULT 'aprovado';

-- Garantir que motoristas existentes estejam aprovados
UPDATE membros SET status_aprovacao = 'aprovado' WHERE is_motorista = TRUE AND status_aprovacao IS NULL;
