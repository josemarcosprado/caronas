-- Ensure groups are readable by everyone (authenticated or anonymous) for the listing page
DROP POLICY IF EXISTS "Permitir ler grupos" ON grupos;

CREATE POLICY "Permitir ler grupos" ON grupos
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Ensure members count (via joins) is also accessible if needed, or just relying on public access
-- The previous policy seemed correct, but re-applying to be sure.
