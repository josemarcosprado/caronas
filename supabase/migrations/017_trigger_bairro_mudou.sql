-- Trigger: Update 'bairro_mudou' in membros when user updates their profile
-- Used to notify drivers

CREATE OR REPLACE FUNCTION handle_bairro_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o bairro mudou
    IF NEW.bairro IS DISTINCT FROM OLD.bairro THEN
        -- Atualizar flag em todos os grupos onde o usuário é membro ativo
        UPDATE membros
        SET bairro_mudou = TRUE
        WHERE usuario_id = NEW.id
          AND ativo = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar trigger se existir para evitar duplicação em re-runs
DROP TRIGGER IF EXISTS on_bairro_change ON usuarios;

CREATE TRIGGER on_bairro_change
    AFTER UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION handle_bairro_change();
