-- Tabela para armazenar códigos de verificação temporários
CREATE TABLE IF NOT EXISTS codigos_verificacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefone VARCHAR(20) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para busca rápida
CREATE INDEX idx_codigos_telefone ON codigos_verificacao(telefone);

-- RLS
ALTER TABLE codigos_verificacao ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode acessar (bot)
CREATE POLICY "Service role pode fazer tudo em codigos_verificacao" 
ON codigos_verificacao
FOR ALL 
USING (auth.role() = 'service_role');
