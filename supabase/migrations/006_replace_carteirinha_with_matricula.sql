-- Migração: Substituir carteirinha (foto) por matrícula (texto)
-- Execute este script no Supabase SQL Editor

-- Adicionar campo para número de matrícula do estudante
ALTER TABLE membros ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);
