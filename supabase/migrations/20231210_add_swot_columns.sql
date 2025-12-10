-- Migration: Add SWOT analysis columns
-- These columns store strengths, weaknesses, and key differentiators as arrays

-- Add SWOT columns
ALTER TABLE competitors 
ADD COLUMN IF NOT EXISTS strengths TEXT[],
ADD COLUMN IF NOT EXISTS weaknesses TEXT[],
ADD COLUMN IF NOT EXISTS key_differentiators TEXT[];

-- Add founders_data if not exists (for structured founder info)
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS founders_structured JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN competitors.strengths IS 'Competitive strengths identified from analysis';
COMMENT ON COLUMN competitors.weaknesses IS 'Potential weaknesses or risks identified';
COMMENT ON COLUMN competitors.key_differentiators IS 'Key differentiators vs competitors';
COMMENT ON COLUMN competitors.founders_structured IS 'Structured founder data with name, role, linkedin';

-- Create GIN indexes for efficient array queries
CREATE INDEX IF NOT EXISTS idx_competitors_strengths_gin ON competitors USING GIN(strengths);
CREATE INDEX IF NOT EXISTS idx_competitors_weaknesses_gin ON competitors USING GIN(weaknesses);
