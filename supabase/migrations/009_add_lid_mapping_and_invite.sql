-- Migration 009: Add LID mapping table and invite link support

-- Tabela de mapeamento LID → telefone
-- Armazena a relação entre o LID do WhatsApp e o número de telefone real
CREATE TABLE IF NOT EXISTS lid_mapping (
    lid TEXT NOT NULL,
    telefone TEXT NOT NULL,
    grupo_whatsapp_id TEXT NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (lid, grupo_whatsapp_id)
);

CREATE INDEX IF NOT EXISTS idx_lid_mapping_lid ON lid_mapping(lid);
CREATE INDEX IF NOT EXISTS idx_lid_mapping_telefone ON lid_mapping(telefone);
CREATE INDEX IF NOT EXISTS idx_lid_mapping_grupo ON lid_mapping(grupo_whatsapp_id);

-- Adicionar coluna invite_link na tabela de grupos
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS invite_link TEXT;
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS invite_link_atualizado_em TIMESTAMP WITH TIME ZONE;

-- RLS para lid_mapping (bot usa service_role, mas adicionar para segurança)
ALTER TABLE lid_mapping ENABLE ROW LEVEL SECURITY;

-- Política: service_role tem acesso total (o bot usa service_role key)
-- Para o MVP, não precisamos de políticas específicas pois o bot faz bypass via service_role
