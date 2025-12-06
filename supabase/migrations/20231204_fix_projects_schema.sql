-- Add missing columns to projects table if they don't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_regions TEXT[] DEFAULT '{}';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload config';
