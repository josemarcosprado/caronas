-- Cajurona MVP - Schema do Banco de Dados
-- Execute este script no Supabase SQL Editor

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE tipo_viagem AS ENUM ('ida', 'volta');
CREATE TYPE status_viagem AS ENUM ('agendada', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE status_presenca AS ENUM ('confirmado', 'cancelado', 'pendente', 'atrasado');

-- Tabela de Grupos
CREATE TABLE grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    whatsapp_group_id VARCHAR(100) UNIQUE,
    motorista_id UUID,
    valor_semanal DECIMAL(10,2) DEFAULT 0,
    horario_ida TIME DEFAULT '07:00',
    horario_volta TIME DEFAULT '18:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Membros
CREATE TABLE membros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    whatsapp_id VARCHAR(100),
    dias_padrao JSONB DEFAULT '[]'::jsonb, -- ["seg", "ter", "qua", "qui", "sex"]
    is_motorista BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    senha_hash VARCHAR(255), -- Apenas para motoristas (admin)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar FK do motorista após criar tabela membros
ALTER TABLE grupos ADD CONSTRAINT fk_motorista 
    FOREIGN KEY (motorista_id) REFERENCES membros(id);

-- Tabela de Viagens
CREATE TABLE viagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    tipo tipo_viagem NOT NULL,
    horario_partida TIME NOT NULL,
    status status_viagem DEFAULT 'agendada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(grupo_id, data, tipo)
);

-- Tabela de Presenças
CREATE TABLE presencas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viagem_id UUID REFERENCES viagens(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES membros(id) ON DELETE CASCADE,
    status status_presenca DEFAULT 'pendente',
    horario_atraso TIME,
    observacao TEXT,
    confirmado_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(viagem_id, membro_id)
);

-- Tabela de Logs
CREATE TABLE logs_atividade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membro_id UUID REFERENCES membros(id),
    tipo_acao VARCHAR(50) NOT NULL,
    mensagem_original TEXT,
    intencao_detectada VARCHAR(50),
    confianca DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX idx_viagens_data ON viagens(data);
CREATE INDEX idx_viagens_grupo ON viagens(grupo_id);
CREATE INDEX idx_presencas_viagem ON presencas(viagem_id);
CREATE INDEX idx_presencas_membro ON presencas(membro_id);
CREATE INDEX idx_membros_telefone ON membros(telefone);
CREATE INDEX idx_membros_grupo ON membros(grupo_id);

-- View para status da semana
CREATE OR REPLACE VIEW vw_status_semana AS
SELECT 
    v.id AS viagem_id,
    v.data,
    v.tipo,
    v.horario_partida,
    v.status AS status_viagem,
    v.grupo_id,
    m.id AS membro_id,
    m.nome AS membro_nome,
    p.status AS status_presenca,
    p.horario_atraso,
    p.observacao,
    g.valor_semanal,
    g.nome AS grupo_nome
FROM viagens v
JOIN grupos g ON v.grupo_id = g.id
LEFT JOIN presencas p ON v.id = p.viagem_id
LEFT JOIN membros m ON p.membro_id = m.id
WHERE v.data >= DATE_TRUNC('week', CURRENT_DATE)
  AND v.data < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days';

-- RLS (Row Level Security)
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_atividade ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (read para todos autenticados no grupo)
-- Nota: Para o MVP com bot, usaremos service_role key para bypass RLS

-- Função para criar viagens da semana
CREATE OR REPLACE FUNCTION criar_viagens_semana(p_grupo_id UUID)
RETURNS void AS $$
DECLARE
    v_data DATE;
    v_horario_ida TIME;
    v_horario_volta TIME;
BEGIN
    SELECT horario_ida, horario_volta INTO v_horario_ida, v_horario_volta
    FROM grupos WHERE id = p_grupo_id;
    
    -- Criar viagens para cada dia útil da semana atual
    FOR v_data IN 
        SELECT generate_series(
            DATE_TRUNC('week', CURRENT_DATE)::DATE,
            DATE_TRUNC('week', CURRENT_DATE)::DATE + 4, -- seg a sex
            '1 day'::INTERVAL
        )::DATE
    LOOP
        -- Viagem de ida
        INSERT INTO viagens (grupo_id, data, tipo, horario_partida)
        VALUES (p_grupo_id, v_data, 'ida', v_horario_ida)
        ON CONFLICT (grupo_id, data, tipo) DO NOTHING;
        
        -- Viagem de volta
        INSERT INTO viagens (grupo_id, data, tipo, horario_partida)
        VALUES (p_grupo_id, v_data, 'volta', v_horario_volta)
        ON CONFLICT (grupo_id, data, tipo) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para resetar presenças semanais (baseado em dias_padrao)
CREATE OR REPLACE FUNCTION resetar_presencas_semana(p_grupo_id UUID)
RETURNS void AS $$
DECLARE
    v_membro RECORD;
    v_viagem RECORD;
    v_dia_semana VARCHAR(3);
BEGIN
    -- Para cada membro ativo do grupo
    FOR v_membro IN 
        SELECT id, dias_padrao FROM membros 
        WHERE grupo_id = p_grupo_id AND ativo = TRUE
    LOOP
        -- Para cada viagem da semana
        FOR v_viagem IN
            SELECT id, data FROM viagens 
            WHERE grupo_id = p_grupo_id 
            AND data >= DATE_TRUNC('week', CURRENT_DATE)
            AND data < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
        LOOP
            -- Mapear dia da semana
            v_dia_semana := CASE EXTRACT(DOW FROM v_viagem.data)
                WHEN 1 THEN 'seg'
                WHEN 2 THEN 'ter'
                WHEN 3 THEN 'qua'
                WHEN 4 THEN 'qui'
                WHEN 5 THEN 'sex'
                ELSE NULL
            END;
            
            -- Se o membro tem esse dia como padrão
            IF v_dia_semana IS NOT NULL AND v_membro.dias_padrao ? v_dia_semana THEN
                INSERT INTO presencas (viagem_id, membro_id, status)
                VALUES (v_viagem.id, v_membro.id, 'pendente')
                ON CONFLICT (viagem_id, membro_id) DO UPDATE SET status = 'pendente';
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
