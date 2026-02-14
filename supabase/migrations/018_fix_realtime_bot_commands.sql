-- Migration 018: Enable Realtime for bot_commands
-- This was missing in 016, causing the bot to not receive INSERT events

-- Add table to publication
alter publication supabase_realtime add table bot_commands;

-- Verify (optional, for debugging)
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
