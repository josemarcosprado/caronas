-- RPC Function para solicitar reset de senha
-- O frontend chama essa function com o telefone do usuário
-- Ela gera o código, salva no banco, e retorna sucesso
-- O bot escuta inserts nessa tabela via Realtime e envia o WhatsApp

CREATE OR REPLACE FUNCTION solicitar_reset_senha(p_telefone TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões elevadas (bypass RLS)
AS $$
DECLARE
    v_usuario RECORD;
    v_codigo TEXT;
    v_expires_at TIMESTAMPTZ;
    v_telefone_limpo TEXT;
    v_variante1 TEXT;
    v_variante2 TEXT;
BEGIN
    -- Normalizar telefone (apenas números)
    v_telefone_limpo := regexp_replace(p_telefone, '\D', '', 'g');
    
    -- Criar variantes do telefone
    v_variante1 := v_telefone_limpo;
    v_variante2 := NULL;
    
    IF NOT v_telefone_limpo LIKE '55%' THEN
        v_variante2 := '55' || v_telefone_limpo;
    END IF;
    
    IF v_telefone_limpo LIKE '55%' AND length(v_telefone_limpo) > 2 THEN
        v_variante2 := substring(v_telefone_limpo FROM 3);
    END IF;
    
    -- Buscar usuário
    SELECT id, telefone, nome INTO v_usuario
    FROM usuarios
    WHERE telefone = v_variante1
       OR (v_variante2 IS NOT NULL AND telefone = v_variante2)
    LIMIT 1;
    
    IF v_usuario IS NULL THEN
        -- Por segurança, não revelar que não existe
        RETURN json_build_object('success', true, 'message', 'Se o telefone estiver cadastrado, você receberá um código.');
    END IF;
    
    -- Gerar código de 6 dígitos
    v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');
    
    -- Expiração: 15 minutos
    v_expires_at := now() + interval '15 minutes';
    
    -- Invalidar códigos anteriores
    DELETE FROM codigos_verificacao WHERE telefone = v_usuario.telefone;
    
    -- Inserir novo código (o bot vai detectar via Realtime e enviar WhatsApp)
    INSERT INTO codigos_verificacao (telefone, codigo, expires_at)
    VALUES (v_usuario.telefone, v_codigo, v_expires_at);
    
    RETURN json_build_object('success', true, 'message', 'Se o telefone estiver cadastrado, você receberá um código.');
END;
$$;

-- Permitir que anon e authenticated chamem essa function
GRANT EXECUTE ON FUNCTION solicitar_reset_senha(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION solicitar_reset_senha(TEXT) TO authenticated;

-- RPC Function para resetar senha com código
CREATE OR REPLACE FUNCTION resetar_senha_com_codigo(p_telefone TEXT, p_codigo TEXT, p_nova_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario RECORD;
    v_codigo_record RECORD;
    v_telefone_limpo TEXT;
    v_variante1 TEXT;
    v_variante2 TEXT;
BEGIN
    -- Normalizar telefone
    v_telefone_limpo := regexp_replace(p_telefone, '\D', '', 'g');
    
    v_variante1 := v_telefone_limpo;
    v_variante2 := NULL;
    
    IF NOT v_telefone_limpo LIKE '55%' THEN
        v_variante2 := '55' || v_telefone_limpo;
    END IF;
    
    IF v_telefone_limpo LIKE '55%' AND length(v_telefone_limpo) > 2 THEN
        v_variante2 := substring(v_telefone_limpo FROM 3);
    END IF;
    
    -- Buscar usuário
    SELECT id, telefone INTO v_usuario
    FROM usuarios
    WHERE telefone = v_variante1
       OR (v_variante2 IS NOT NULL AND telefone = v_variante2)
    LIMIT 1;
    
    IF v_usuario IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Usuário não encontrado.');
    END IF;
    
    -- Verificar código
    SELECT * INTO v_codigo_record
    FROM codigos_verificacao
    WHERE telefone = v_usuario.telefone
      AND codigo = p_codigo
      AND expires_at > now()
    LIMIT 1;
    
    IF v_codigo_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Código inválido ou expirado.');
    END IF;
    
    -- Atualizar senha
    UPDATE usuarios SET senha_hash = p_nova_senha WHERE id = v_usuario.id;
    
    -- Deletar código usado
    DELETE FROM codigos_verificacao WHERE id = v_codigo_record.id;
    
    RETURN json_build_object('success', true, 'message', 'Senha redefinida com sucesso!');
END;
$$;

-- Permitir chamada
GRANT EXECUTE ON FUNCTION resetar_senha_com_codigo(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION resetar_senha_com_codigo(TEXT, TEXT, TEXT) TO authenticated;

-- Habilitar Realtime na tabela codigos_verificacao para o bot escutar
ALTER PUBLICATION supabase_realtime ADD TABLE codigos_verificacao;
