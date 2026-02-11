-- Migração: Adicionar campo de carteirinha para todos os membros
-- Execute este script no Supabase SQL Editor

-- Adicionar campo para URL da foto da carteirinha de estudante
ALTER TABLE membros ADD COLUMN IF NOT EXISTS carteirinha_url TEXT;

-- Membros existentes já aprovados não precisam de carteirinha (retrocompatível)
