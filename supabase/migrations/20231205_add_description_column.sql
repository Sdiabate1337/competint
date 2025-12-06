-- Add description column to competitors table
ALTER TABLE competitors 
ADD COLUMN IF NOT EXISTS description text;
