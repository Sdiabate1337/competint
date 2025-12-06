-- Add embedding column to competitors table
-- Enable vector extension if not enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE competitors 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS idx_competitors_embedding 
ON competitors 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
