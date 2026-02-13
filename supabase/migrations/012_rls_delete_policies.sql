-- Migration 012: Add DELETE RLS policies for grupos, membros, usuarios
-- Needed for: excluir grupo, sair do grupo, deletar conta

CREATE POLICY "Permitir deletar grupos"
    ON grupos FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Permitir deletar membros"
    ON membros FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Permitir deletar usuarios"
    ON usuarios FOR DELETE TO anon, authenticated USING (true);
