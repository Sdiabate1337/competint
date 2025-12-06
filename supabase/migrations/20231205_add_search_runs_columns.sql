-- Add missing columns to search_runs table
ALTER TABLE search_runs 
  ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS results_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT;
