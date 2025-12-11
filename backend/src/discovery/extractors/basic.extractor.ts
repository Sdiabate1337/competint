/**
 * Basic Extractor
 * 
 * Extracts basic competitor data from search results using AI.
 * Used in Phase 1 (FREE tier) - fast extraction of essential info.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { SearchResult, BasicCompetitor } from '../types';

@Injectable()
export class BasicExtractor {
  private readonly logger = new Logger(BasicExtractor.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Extract basic competitor data from search results
   */
  async extract(
    searchResults: SearchResult[],
    context: { keywords: string[]; regions: string[]; industry?: string },
  ): Promise<BasicCompetitor[]> {
    if (searchResults.length === 0) {
      return [];
    }

    // Limit to avoid token overflow
    const limitedResults = searchResults.slice(0, 15);

    // Build content for AI analysis
    const contentBlocks = limitedResults.map((r, i) => `
[SOURCE ${i + 1}]
URL: ${r.url}
Title: ${r.title}
Snippet: ${r.snippet}
${r.content ? `Content: ${r.content.substring(0, 1500)}` : ''}
`).join('\n---\n');

    const prompt = `You are a competitive intelligence analyst. Extract company information from these search results.

CONTEXT:
- Industry focus: ${context.industry || context.keywords.join(', ')}
- Target regions: ${context.regions.join(', ')}
- Keywords: ${context.keywords.join(', ')}

SEARCH RESULTS:
${contentBlocks}

TASK:
Extract ALL distinct companies mentioned. For each company, provide:
- name: Official company name
- website: Company website URL (use the source URL if it's the company's site)
- description: 2-3 sentence description of what they do
- industry: Their primary industry/sector
- country: ISO 2-letter country code (NG, KE, US, etc.)

RULES:
1. Extract companies from BOTH direct company pages AND articles listing multiple companies
2. If an article mentions "Top 10 Fintechs", extract all 10 companies
3. Skip generic sites (news sites, directories) unless they ARE the company
4. Deduplicate - each company should appear only once
5. Only include companies relevant to the search context

Return ONLY a valid JSON array. No markdown, no explanations.
Example: [{"name": "Paystack", "website": "https://paystack.com", "description": "...", "industry": "Fintech", "country": "NG"}]`;

    try {
      this.logger.log(`[BasicExtractor] Extracting from ${limitedResults.length} search results`);

      const response = await this.aiService.chat([
        { 
          role: 'system', 
          content: 'You are a business analyst. Extract company information accurately. Return only valid JSON.' 
        },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.2,
        maxTokens: 4000,
      });

      const content = response.content || '';
      
      // Extract JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('[BasicExtractor] No JSON array in response');
        this.logger.debug(`[BasicExtractor] Response: ${content.substring(0, 500)}`);
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        this.logger.warn('[BasicExtractor] Response is not an array');
        return [];
      }

      // Validate and clean results
      const competitors: BasicCompetitor[] = parsed
        .filter((c: any) => c.name && c.website)
        .map((c: any) => ({
          name: c.name.trim(),
          website: this.normalizeUrl(c.website),
          description: c.description?.trim() || '',
          industry: c.industry?.trim() || context.industry || '',
          country: (c.country || '').toUpperCase().substring(0, 2),
          logo_url: c.logo_url || undefined,
        }));

      this.logger.log(`[BasicExtractor] Extracted ${competitors.length} competitors`);
      
      return competitors;

    } catch (error) {
      this.logger.error(`[BasicExtractor] Extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Normalize URL format
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    
    let normalized = url.trim();
    
    // Add protocol if missing
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    
    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');
    
    return normalized;
  }
}
