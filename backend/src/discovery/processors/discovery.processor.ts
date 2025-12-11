/**
 * Discovery Processor
 * 
 * BullMQ worker that handles Phase 1: Basic Discovery
 * 
 * Flow:
 * 1. Search using Firecrawl (or fallback to AI)
 * 2. Extract basic competitor data using AI
 * 3. Deduplicate against existing competitors
 * 4. Save to database
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../../supabase/supabase.service';
import { FirecrawlProvider } from '../providers/firecrawl.provider';
import { AiFallbackProvider } from '../providers/ai-fallback.provider';
import { BasicExtractor } from '../extractors/basic.extractor';
import { DiscoveryContext, SearchResult, BasicCompetitor, DiscoveryStatus } from '../types';

@Processor('discovery')
export class DiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DiscoveryProcessor.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly firecrawlProvider: FirecrawlProvider,
    private readonly aiFallbackProvider: AiFallbackProvider,
    private readonly basicExtractor: BasicExtractor,
  ) {
    super();
  }

  async process(job: Job<DiscoveryContext>) {
    const context = job.data;
    const startTime = Date.now();

    this.logger.log(`[Discovery] === START ===`);
    this.logger.log(`[Discovery] Run ID: ${context.runId}`);
    this.logger.log(`[Discovery] Keywords: ${context.keywords.join(', ')}`);
    this.logger.log(`[Discovery] Regions: ${context.regions.join(', ')}`);

    try {
      // Step 1: Update status to searching
      await this.updateStatus(context.runId, 'searching');

      // Step 2: Search for competitors
      const searchResults = await this.searchCompetitors(context);
      this.logger.log(`[Discovery] Found ${searchResults.length} search results`);

      if (searchResults.length === 0) {
        await this.updateStatus(context.runId, 'completed', 0);
        return { competitorsFound: 0, duration: Date.now() - startTime };
      }

      // Step 3: Update status to extracting
      await this.updateStatus(context.runId, 'extracting');

      // Step 4: Extract competitor data
      const competitors = await this.basicExtractor.extract(searchResults, {
        keywords: context.keywords,
        regions: context.regions,
        industry: context.industries?.[0],
      });
      this.logger.log(`[Discovery] Extracted ${competitors.length} competitors`);

      // Step 5: Deduplicate
      const uniqueCompetitors = await this.deduplicateCompetitors(
        competitors,
        context.organizationId,
      );
      this.logger.log(`[Discovery] ${uniqueCompetitors.length} unique competitors after dedup`);

      // Step 6: Save to database
      const savedCount = await this.saveCompetitors(
        uniqueCompetitors,
        context.runId,
        context.organizationId,
      );
      this.logger.log(`[Discovery] Saved ${savedCount} competitors`);

      // Step 7: Complete
      await this.updateStatus(context.runId, 'completed', savedCount);

      const duration = Date.now() - startTime;
      this.logger.log(`[Discovery] === COMPLETE === (${duration}ms)`);

      return { competitorsFound: savedCount, duration };

    } catch (error) {
      this.logger.error(`[Discovery] Failed: ${error.message}`);
      await this.updateStatus(context.runId, 'failed', 0, error.message);
      throw error;
    }
  }

  /**
   * Search for competitors using providers with fallback
   */
  private async searchCompetitors(context: DiscoveryContext): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    // Build search queries
    const queries = this.buildSearchQueries(context);
    this.logger.log(`[Discovery] Built ${queries.length} search queries`);

    // Try Firecrawl first
    if (this.firecrawlProvider.isAvailable()) {
      for (const query of queries) {
        const response = await this.firecrawlProvider.search(query, {
          limit: 10,
          scrapeContent: true,
        });

        if (response.success) {
          for (const result of response.results) {
            if (!seenUrls.has(result.url)) {
              seenUrls.add(result.url);
              allResults.push(result);
            }
          }
        } else if (response.error === 'INSUFFICIENT_CREDITS') {
          this.logger.warn('[Discovery] Firecrawl credits exhausted, using fallback');
          break;
        }

        // Rate limiting
        await this.delay(500);
      }
    }

    // Fallback to AI if no results
    if (allResults.length === 0) {
      this.logger.log('[Discovery] Using AI fallback provider');
      
      const response = await this.aiFallbackProvider.search(
        context.keywords,
        context.regions,
        { 
          limit: context.maxResults || 10,
          industry: context.industries?.[0],
        },
      );

      if (response.success) {
        allResults.push(...response.results);
      }
    }

    return allResults;
  }

  /**
   * Build search queries from context
   */
  private buildSearchQueries(context: DiscoveryContext): string[] {
    const queries: string[] = [];
    const industry = context.industries?.[0] || '';

    for (const keyword of context.keywords) {
      for (const region of context.regions) {
        const regionName = this.getRegionName(region);
        
        // Primary query
        queries.push(`${keyword} startup ${regionName}`);
        
        // With industry if available
        if (industry) {
          queries.push(`${keyword} ${industry} company ${regionName}`);
        }
      }
    }

    // Limit queries to avoid excessive API calls
    return queries.slice(0, 5);
  }

  /**
   * Deduplicate competitors against existing ones in DB
   */
  private async deduplicateCompetitors(
    competitors: BasicCompetitor[],
    organizationId: string,
  ): Promise<BasicCompetitor[]> {
    // First, dedupe within the batch by domain
    const byDomain = new Map<string, BasicCompetitor>();
    
    for (const comp of competitors) {
      const domain = this.extractDomain(comp.website);
      if (domain && !byDomain.has(domain)) {
        byDomain.set(domain, comp);
      }
    }

    const uniqueCompetitors = Array.from(byDomain.values());

    // Then check against existing competitors in DB
    const { data: existing } = await this.supabaseService
      .getClient()
      .from('competitors')
      .select('website')
      .eq('organization_id', organizationId);

    const existingDomains = new Set(
      (existing || [])
        .map(c => this.extractDomain(c.website))
        .filter(Boolean),
    );

    return uniqueCompetitors.filter(c => {
      const domain = this.extractDomain(c.website);
      return domain && !existingDomains.has(domain);
    });
  }

  /**
   * Save competitors to database
   */
  private async saveCompetitors(
    competitors: BasicCompetitor[],
    runId: string,
    organizationId: string,
  ): Promise<number> {
    if (competitors.length === 0) return 0;

    const records = competitors.map(c => ({
      organization_id: organizationId,
      search_run_id: runId,
      name: c.name,
      website: c.website,
      description: c.description,
      industry: c.industry,
      country: c.country,
      logo_url: c.logo_url,
      validation_status: 'pending',
      enrichment_status: 'basic',
    }));

    const { data, error } = await this.supabaseService
      .getClient()
      .from('competitors')
      .insert(records)
      .select('id');

    if (error) {
      this.logger.error(`[Discovery] Save failed: ${error.message}`);
      throw new Error(`Failed to save competitors: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Update discovery run status
   */
  private async updateStatus(
    runId: string,
    status: DiscoveryStatus,
    resultsCount?: number,
    errorMessage?: string,
  ) {
    const update: any = { status };
    
    if (resultsCount !== undefined) {
      update.results_count = resultsCount;
    }
    
    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      update.error_message = errorMessage;
    }

    await this.supabaseService
      .getClient()
      .from('search_runs')
      .update(update)
      .eq('id', runId);
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '').toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Get region name from code
   */
  private getRegionName(code: string): string {
    const regions: Record<string, string> = {
      'NG': 'Nigeria',
      'KE': 'Kenya',
      'CI': 'Ivory Coast',
      'GH': 'Ghana',
      'ZA': 'South Africa',
      'EG': 'Egypt',
    };
    return regions[code.toUpperCase()] || code;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
