-- Políticas RLS para permitir operações do frontend
-- Execute no Supabase SQL Editor

-- =====================
-- GRUPOS
-- =====================
-- Qualquer um pode criar um grupo (para a tela /criar)
CREATE POLICY "Permitir criar grupos" ON grupos
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Qualquer um pode ler grupos (dashboard público)
CREATE POLICY "Permitir ler grupos" ON grupos
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Atualização de grupos (para setar motorista_id no frontend)
CREATE POLICY "Permitir atualizar grupos" ON grupos
    FOR UPDATE
    TO anon, authenticated
    USING (true);

-- =====================
-- MEMBROS
-- =====================
-- Criar membro (para cadastro do motorista e novos membros)
CREATE POLICY "Permitir criar membros" ON membros
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Ler membros do grupo
CREATE POLICY "Permitir ler membros" ON membros
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- =====================
-- VIAGENS
-- =====================
CREATE POLICY "Permitir ler viagens" ON viagens
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir criar viagens" ON viagens
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- =====================
-- PRESENCAS
-- =====================
CREATE POLICY "Permitir ler presencas" ON presencas
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir criar presencas" ON presencas
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Permitir atualizar presencas" ON presencas
    FOR UPDATE
    TO anon, authenticated
    USING (true);

-- =====================
-- TRANSACOES
-- =====================
CREATE POLICY "Permitir ler transacoes" ON transacoes
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir criar transacoes" ON transacoes
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Permitir deletar transacoes" ON transacoes
    FOR DELETE
    TO anon, authenticated
    USING (true);

-- =====================
-- LOGS
-- =====================
CREATE POLICY "Permitir criar logs" ON logs_atividade
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
