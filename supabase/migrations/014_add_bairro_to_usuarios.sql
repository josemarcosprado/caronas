-- Migration 014: Add bairro (neighborhood) to usuarios table
-- Stored in lowercase to ensure consistent comparisons

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

-- Ensure existing rows have a default empty string (optional)
-- UPDATE usuarios SET bairro = '' WHERE bairro IS NULL;
