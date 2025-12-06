import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
}

@Injectable()
export class TavilyService {
    private readonly logger = new Logger(TavilyService.name);
    private readonly apiKey: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('TAVILY_API_KEY') || '';

        if (!this.apiKey) {
            this.logger.warn('TAVILY_API_KEY not configured - Tavily features will be disabled');
        }
    }

    async search(query: string, options?: {
        maxResults?: number;
        searchDepth?: 'basic' | 'advanced';
        includeRawContent?: boolean;
        country?: string;
    }): Promise<TavilySearchResult[]> {
        if (!this.apiKey) {
            this.logger.warn('Tavily API not configured, returning MOCK results for development');

            // Return mock data for development/testing
            return [{
                title: `Mock Competitor: ${query} Startup`,
                url: `https://example-${query.replace(/\s+/g, '-').toLowerCase()}.com`,
                content: `This is a mock fintech startup based in Nigeria. Founded in 2022, they focus on digital payments and mobile money transfer. They have raised $2M in seed funding and are growing rapidly across West Africa.`,
                score: 0.95,
                raw_content: `# About ${query} Startup
                
## Overview
A leading fintech company revolutionizing payments in Africa.

## Business Model
B2C mobile payments platform with agent network.

## Traction
- 50,000+ active users
- $500K monthly transaction volume
- Operating in Nigeria and Ghana

## Team
Founded by experienced entrepreneurs with backgrounds in finance and technology.

## Funding
Seed round: $2M from leading African VCs

## Technology
React Native app, Node.js backend, blockchain integration`,
            }, {
                title: `${query} Payment Solutions`,
                url: `https://paytech-${query.replace(/\s+/g, '-').toLowerCase()}.africa`,
                content: `Digital payment platform serving small businesses across Nigeria. They offer POS terminals and mobile payment solutions with competitive rates.`,
                score: 0.88,
                raw_content: `# PayTech Solutions
                
Growing payment provider in West Africa with focus on SMEs.

**Value Proposition:** Low-cost payment acceptance for small merchants
**Business Model:** Transaction fees + hardware sales  
**Market:** Nigeria, Ghana, Kenya
**Founded:** 2021
**Team Size:** 15-20 employees`,
            }];
        }

        try {
            const tvly = tavily({ apiKey: this.apiKey });

            this.logger.log(`Tavily search: "${query}"`);

            const response = await tvly.search(query, {
                maxResults: options?.maxResults || 10,
                searchDepth: options?.searchDepth || 'basic',
                includeRawContent: options?.includeRawContent ? 'markdown' : undefined,
                includeImages: false,
            });

            if (!response.results || response.results.length === 0) {
                this.logger.warn(`No results found for: ${query}`);
                return [];
            }

            return response.results.map((result: any) => ({
                title: result.title,
                url: result.url,
                content: result.content,
                score: result.score,
                raw_content: result.rawContent,
            }));
        } catch (error) {
            this.logger.error(`Tavily API error: ${error.message}`);
            return [];
        }
    }

    async searchWithContext(query: string, context: {
        region?: string;
        industry?: string;
    }, options?: {
        maxResults?: number;
    }): Promise<TavilySearchResult[]> {
        // Enhance query with context
        let enhancedQuery = query;

        if (context.region) {
            enhancedQuery += ` in ${context.region}`;
        }

        if (context.industry) {
            enhancedQuery += ` ${context.industry}`;
        }

        return this.search(enhancedQuery, {
            maxResults: options?.maxResults || 10,
            searchDepth: 'advanced', // Use advanced for better quality
            includeRawContent: true, // Get full content for AI extraction
        });
    }

    async batchSearch(queries: string[], options?: {
        maxResultsPerQuery?: number;
        delayBetweenRequests?: number;
    }): Promise<Map<string, TavilySearchResult[]>> {
        const results = new Map<string, TavilySearchResult[]>();
        const delay = options?.delayBetweenRequests || 1000;

        for (const query of queries) {
            const searchResults = await this.search(query, {
                maxResults: options?.maxResultsPerQuery || 5,
            });

            results.set(query, searchResults);

            // Rate limiting
            if (queries.indexOf(query) < queries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }
}
