-- Migração: Configurar políticas RLS do Supabase Storage
-- Execute este script no Supabase SQL Editor

-- =====================
-- BUCKETS
-- =====================
-- Criar buckets caso não existam (com acesso público para leitura de URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cnh-uploads', 'cnh-uploads', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('carteirinha-uploads', 'carteirinha-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- =====================
-- POLÍTICAS DE CNH
-- =====================
-- Permitir upload de CNH (anon e authenticated)
CREATE POLICY "Permitir upload CNH" ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'cnh-uploads');

-- Permitir leitura de CNH (para exibir no painel de aprovações)
CREATE POLICY "Permitir leitura CNH" ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'cnh-uploads');

-- =====================
-- POLÍTICAS DE CARTEIRINHA
-- =====================
-- Permitir upload de carteirinha
CREATE POLICY "Permitir upload carteirinha" ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'carteirinha-uploads');

-- Permitir leitura de carteirinha
CREATE POLICY "Permitir leitura carteirinha" ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'carteirinha-uploads');

-- =====================
-- POLÍTICA DE UPDATE PARA MEMBROS
-- =====================
-- Necessário para aprovar/rejeitar membros no Dashboard
-- (a migration 003 não incluiu UPDATE para membros)
CREATE POLICY "Permitir atualizar membros" ON membros
    FOR UPDATE
    TO anon, authenticated
    USING (true);
