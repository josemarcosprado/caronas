-- Migration: Adicionar ON DELETE CASCADE na FK membros -> usuarios
-- Permite deletar usuários sem precisar deletar membros manualmente antes

ALTER TABLE membros 
DROP CONSTRAINT membros_usuario_id_fkey,
ADD CONSTRAINT membros_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
