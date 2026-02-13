-- Migration 013: Add ON DELETE CASCADE to ALL FKs referencing grupos and membros
-- Ensures that deleting a grupo automatically cleans up ALL dependent data:
-- membros, viagens, presencas, transacoes, logs_atividade

-- ============================================================
-- 1. membros → grupos (CASCADE)
-- ============================================================
ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_grupo_id_fkey;
ALTER TABLE membros ADD CONSTRAINT membros_grupo_id_fkey
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE;

-- ============================================================
-- 2. viagens → grupos (CASCADE)
-- ============================================================
ALTER TABLE viagens DROP CONSTRAINT IF EXISTS viagens_grupo_id_fkey;
ALTER TABLE viagens ADD CONSTRAINT viagens_grupo_id_fkey
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE;

-- ============================================================
-- 3. presencas → viagens (CASCADE)
-- ============================================================
ALTER TABLE presencas DROP CONSTRAINT IF EXISTS presencas_viagem_id_fkey;
ALTER TABLE presencas ADD CONSTRAINT presencas_viagem_id_fkey
    FOREIGN KEY (viagem_id) REFERENCES viagens(id) ON DELETE CASCADE;

-- ============================================================
-- 4. presencas → membros (CASCADE)
-- ============================================================
ALTER TABLE presencas DROP CONSTRAINT IF EXISTS presencas_membro_id_fkey;
ALTER TABLE presencas ADD CONSTRAINT presencas_membro_id_fkey
    FOREIGN KEY (membro_id) REFERENCES membros(id) ON DELETE CASCADE;

-- ============================================================
-- 5. logs_atividade → membros (CASCADE)
-- ============================================================
ALTER TABLE logs_atividade DROP CONSTRAINT IF EXISTS logs_atividade_membro_id_fkey;
ALTER TABLE logs_atividade ADD CONSTRAINT logs_atividade_membro_id_fkey
    FOREIGN KEY (membro_id) REFERENCES membros(id) ON DELETE CASCADE;

-- ============================================================
-- 6. grupos.motorista_id → usuarios (SET NULL on delete)
--    So deleting a user doesn't break grupos, just nullifies motorista
-- ============================================================
ALTER TABLE grupos DROP CONSTRAINT IF EXISTS fk_motorista;
ALTER TABLE grupos ADD CONSTRAINT fk_motorista
    FOREIGN KEY (motorista_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ============================================================
-- 7. RLS: Ensure DELETE policies exist for viagens, presencas, logs
-- ============================================================
DO $$
BEGIN
    -- viagens
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'viagens' AND cmd = 'DELETE') THEN
        CREATE POLICY "Permitir deletar viagens" ON viagens FOR DELETE TO anon, authenticated USING (true);
    END IF;

    -- presencas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'presencas' AND cmd = 'DELETE') THEN
        CREATE POLICY "Permitir deletar presencas" ON presencas FOR DELETE TO anon, authenticated USING (true);
    END IF;

    -- logs_atividade
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'logs_atividade' AND cmd = 'DELETE') THEN
        CREATE POLICY "Permitir deletar logs_atividade" ON logs_atividade FOR DELETE TO anon, authenticated USING (true);
    END IF;
END $$;
