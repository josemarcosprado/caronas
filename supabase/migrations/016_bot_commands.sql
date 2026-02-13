-- Migration 016: Create bot_commands table
-- Bridges frontend (Vercel) ↔ bot (LXC container) via Supabase
-- Frontend inserts a command row, bot picks it up via Realtime

CREATE TABLE IF NOT EXISTS bot_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command VARCHAR(50) NOT NULL,         -- 'create_whatsapp_group', 'refresh_invite_link'
    payload JSONB DEFAULT '{}'::jsonb,     -- { "grupoId": "..." }
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'done', 'error'
    result JSONB,                          -- { "inviteLink": "...", "groupJid": "..." }
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert bot_commands"
    ON bot_commands FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow read bot_commands"
    ON bot_commands FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow update bot_commands"
    ON bot_commands FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow delete bot_commands"
    ON bot_commands FOR DELETE TO anon, authenticated USING (true);
