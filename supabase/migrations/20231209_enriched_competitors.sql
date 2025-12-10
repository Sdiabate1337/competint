-- Migration: Add enriched competitor fields
-- This adds comprehensive data fields for competitor enrichment

-- Add new columns to competitors table
ALTER TABLE competitors 
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS headquarters TEXT,
ADD COLUMN IF NOT EXISTS employee_count_range TEXT,
ADD COLUMN IF NOT EXISTS pricing_model TEXT,
ADD COLUMN IF NOT EXISTS target_market TEXT,
ADD COLUMN IF NOT EXISTS products_services TEXT[],
ADD COLUMN IF NOT EXISTS features TEXT[],
ADD COLUMN IF NOT EXISTS integrations TEXT[],
ADD COLUMN IF NOT EXISTS customers TEXT[],
ADD COLUMN IF NOT EXISTS partnerships TEXT[],
ADD COLUMN IF NOT EXISTS awards TEXT[],
ADD COLUMN IF NOT EXISTS press_mentions TEXT[];

-- Funding details
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS funding_stage TEXT,
ADD COLUMN IF NOT EXISTS funding_amount_usd DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS investors TEXT[];

-- Team information
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS leadership_team JSONB DEFAULT '[]'::jsonb;
-- founders is already TEXT[], we'll keep it but also store structured data
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS founders_data JSONB DEFAULT '[]'::jsonb;

-- Social media links and metrics
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS social_metrics JSONB DEFAULT '{}'::jsonb;

-- Contact information
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- AI Analysis
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS competitive_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS market_positioning TEXT,
ADD COLUMN IF NOT EXISTS growth_signals TEXT[],
ADD COLUMN IF NOT EXISTS risk_factors TEXT[];

-- Enrichment metadata
ALTER TABLE competitors
ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS enrichment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_completeness INTEGER DEFAULT 0;

-- Create indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_competitors_funding_stage ON competitors(funding_stage);
CREATE INDEX IF NOT EXISTS idx_competitors_headquarters ON competitors(headquarters);
CREATE INDEX IF NOT EXISTS idx_competitors_confidence ON competitors(confidence_score);
CREATE INDEX IF NOT EXISTS idx_competitors_completeness ON competitors(data_completeness);

-- Create GIN indexes for array fields (for efficient contains queries)
CREATE INDEX IF NOT EXISTS idx_competitors_technologies_gin ON competitors USING GIN(technologies);
CREATE INDEX IF NOT EXISTS idx_competitors_investors_gin ON competitors USING GIN(investors);
CREATE INDEX IF NOT EXISTS idx_competitors_features_gin ON competitors USING GIN(features);

-- Create GIN index for JSONB fields
CREATE INDEX IF NOT EXISTS idx_competitors_social_links_gin ON competitors USING GIN(social_links);

-- Add comments for documentation
COMMENT ON COLUMN competitors.tagline IS 'Company tagline or slogan';
COMMENT ON COLUMN competitors.headquarters IS 'Company headquarters location';
COMMENT ON COLUMN competitors.employee_count_range IS 'Employee count range (e.g., 51-200)';
COMMENT ON COLUMN competitors.funding_stage IS 'Current funding stage (Seed, Series A, etc.)';
COMMENT ON COLUMN competitors.funding_amount_usd IS 'Total funding raised in USD';
COMMENT ON COLUMN competitors.social_links IS 'JSON object with social media URLs (linkedin, twitter, etc.)';
COMMENT ON COLUMN competitors.social_metrics IS 'JSON object with social media metrics (followers, engagement, etc.)';
COMMENT ON COLUMN competitors.competitive_analysis IS 'AI-generated SWOT analysis';
COMMENT ON COLUMN competitors.confidence_score IS 'Data confidence score (0-100)';
COMMENT ON COLUMN competitors.data_completeness IS 'Data completeness percentage (0-100)';
COMMENT ON COLUMN competitors.data_sources IS 'List of data sources used for enrichment';

-- Function to search competitors by social presence
CREATE OR REPLACE FUNCTION search_competitors_by_social(
    org_id UUID,
    min_followers INTEGER DEFAULT 0,
    platforms TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    website TEXT,
    social_links JSONB,
    social_metrics JSONB,
    total_followers INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.website,
        c.social_links,
        c.social_metrics,
        COALESCE((c.social_metrics->>'total_social_followers')::INTEGER, 0) as total_followers
    FROM competitors c
    WHERE c.organization_id = org_id
        AND COALESCE((c.social_metrics->>'total_social_followers')::INTEGER, 0) >= min_followers
        AND (
            array_length(platforms, 1) IS NULL 
            OR EXISTS (
                SELECT 1 FROM unnest(platforms) p 
                WHERE c.social_links ? p
            )
        )
    ORDER BY total_followers DESC;
END;
$$;

-- Function to get competitors by funding stage
CREATE OR REPLACE FUNCTION get_competitors_by_funding(
    org_id UUID,
    stages TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    website TEXT,
    funding_stage TEXT,
    funding_amount_usd DECIMAL,
    investors TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.website,
        c.funding_stage,
        c.funding_amount_usd,
        c.investors
    FROM competitors c
    WHERE c.organization_id = org_id
        AND (
            array_length(stages, 1) IS NULL 
            OR c.funding_stage = ANY(stages)
        )
    ORDER BY c.funding_amount_usd DESC NULLS LAST;
END;
$$;

-- Function to find competitors using specific technologies
CREATE OR REPLACE FUNCTION find_competitors_by_tech(
    org_id UUID,
    tech_stack TEXT[]
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    website TEXT,
    technologies TEXT[],
    matching_techs TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.website,
        c.technologies,
        ARRAY(
            SELECT unnest(c.technologies) 
            INTERSECT 
            SELECT unnest(tech_stack)
        ) as matching_techs
    FROM competitors c
    WHERE c.organization_id = org_id
        AND c.technologies && tech_stack
    ORDER BY array_length(
        ARRAY(SELECT unnest(c.technologies) INTERSECT SELECT unnest(tech_stack)), 1
    ) DESC NULLS LAST;
END;
$$;
