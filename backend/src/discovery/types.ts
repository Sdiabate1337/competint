/**
 * Discovery Module Types
 */

// Search result from any provider
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string; // Full markdown content if available
}

// Basic competitor data (FREE tier)
export interface BasicCompetitor {
  name: string;
  website: string;
  description: string;
  industry: string;
  country: string; // ISO 2-letter code
  logo_url?: string;
}

// Enriched competitor data (PREMIUM tier)
export interface EnrichedCompetitor extends BasicCompetitor {
  funding_amount?: number;
  funding_stage?: string;
  investors?: string[];
  founders?: string[];
  team_size?: number;
  products?: string[];
  pricing_model?: string;
  social_metrics?: {
    twitter_followers?: number;
    linkedin_followers?: number;
    github_stars?: number;
  };
  swot_analysis?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  news?: Array<{
    title: string;
    url: string;
    date: string;
  }>;
  crunchbase_url?: string;
}

// Discovery run status
export type DiscoveryStatus = 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';

// Discovery context
export interface DiscoveryContext {
  runId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  keywords: string[];
  regions: string[];
  industries?: string[];
  maxResults?: number;
  isPremium: boolean;
}

// Provider response
export interface ProviderResponse {
  success: boolean;
  results: SearchResult[];
  provider: 'firecrawl' | 'google' | 'ai';
  error?: string;
}
