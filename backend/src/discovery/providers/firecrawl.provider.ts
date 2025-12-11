/**
 * Firecrawl Provider
 * 
 * Primary search provider using Firecrawl API.
 * Provides web search with optional content scraping.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FirecrawlApp from '@mendable/firecrawl-js';
import { SearchResult, ProviderResponse } from '../types';

@Injectable()
export class FirecrawlProvider {
  private readonly logger = new Logger(FirecrawlProvider.name);
  private client: FirecrawlApp | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('FIRECRAWL_API_KEY');
    
    if (apiKey) {
      this.client = new FirecrawlApp({ apiKey });
      this.logger.log('Firecrawl provider initialized');
    } else {
      this.logger.warn('FIRECRAWL_API_KEY not set - provider disabled');
    }
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Search for competitors using Firecrawl
   */
  async search(
    query: string,
    options: { limit?: number; scrapeContent?: boolean } = {},
  ): Promise<ProviderResponse> {
    if (!this.client) {
      return {
        success: false,
        results: [],
        provider: 'firecrawl',
        error: 'Firecrawl not configured',
      };
    }

    const limit = options.limit || 10;

    try {
      this.logger.log(`[Firecrawl] Searching: "${query}" (limit: ${limit})`);

      const response = await this.client.search(query, {
        limit,
        scrapeOptions: options.scrapeContent 
          ? { formats: ['markdown'] }
          : undefined,
      });

      // Parse response - handle different SDK response formats
      const results = this.parseResponse(response);
      
      this.logger.log(`[Firecrawl] Found ${results.length} results`);

      return {
        success: true,
        results,
        provider: 'firecrawl',
      };

    } catch (error) {
      this.logger.error(`[Firecrawl] Search failed: ${error.message}`);
      
      // Check for specific errors
      const isCreditsError = error.message?.includes('Insufficient credits');
      const isRateLimitError = error.message?.includes('rate limit');

      return {
        success: false,
        results: [],
        provider: 'firecrawl',
        error: isCreditsError 
          ? 'INSUFFICIENT_CREDITS' 
          : isRateLimitError 
            ? 'RATE_LIMITED' 
            : error.message,
      };
    }
  }

  /**
   * Parse Firecrawl response into standard format
   */
  private parseResponse(response: any): SearchResult[] {
    // Handle different response formats
    let rawResults: any[] = [];

    if (response?.data && Array.isArray(response.data)) {
      rawResults = response.data;
    } else if (response?.web && Array.isArray(response.web)) {
      rawResults = response.web;
    } else if (Array.isArray(response)) {
      rawResults = response;
    }

    return rawResults.map(item => ({
      url: item.url || '',
      title: item.title || item.metadata?.title || '',
      snippet: item.description || item.metadata?.description || '',
      content: item.markdown || item.content || '',
    })).filter(r => r.url);
  }

  /**
   * Scrape a single URL for full content
   */
  async scrape(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Firecrawl not configured' };
    }

    try {
      this.logger.log(`[Firecrawl] Scraping: ${url}`);
      
      const response = await this.client.scrape(url, {
        formats: ['markdown'],
      });

      if (response.markdown) {
        return { success: true, content: response.markdown };
      }

      return { success: false, error: 'No markdown content returned' };

    } catch (error) {
      this.logger.error(`[Firecrawl] Scrape failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
