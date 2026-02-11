-- Migration: Allow multiple group memberships per user
-- 1. Remove unique constraint on phone number (was preventing multiple groups)
-- 2. Add composite unique constraint (phone + group)
-- 3. Add partial unique index to ensure user can be driver in only ONE group

-- 1. Drop old constraint
ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_telefone_key;

-- 2. Add new constraint: Phone must be unique WITHIN a group
ALTER TABLE membros ADD CONSTRAINT membros_grupo_telefone_key UNIQUE (grupo_id, telefone);

-- 3. Add partial unique index: Phone must be unique wherever is_motorista = true
-- This prevents a user from being a driver in more than one group
CREATE UNIQUE INDEX idx_single_driver_per_phone 
ON membros (telefone) 
WHERE is_motorista = TRUE;
