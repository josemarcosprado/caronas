-- Migration 015: Add bairro_mudou flag to membros table
-- Used to notify drivers when a member changes their neighborhood

ALTER TABLE membros ADD COLUMN IF NOT EXISTS bairro_mudou BOOLEAN DEFAULT FALSE;
