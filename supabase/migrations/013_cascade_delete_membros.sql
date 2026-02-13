-- Migration 013: Add ON DELETE CASCADE to membros.grupo_id
-- Ensures that deleting a grupo automatically cleans up associated membros rows.
-- This prevents orphaned membros from blocking future grupo creation
-- (idx_single_driver_per_user unique constraint).

ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_grupo_id_fkey;
ALTER TABLE membros ADD CONSTRAINT membros_grupo_id_fkey
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE;
