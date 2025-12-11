/**
 * AI Fallback Provider
 * 
 * Uses GPT-4 knowledge base to suggest competitors when other providers fail.
 * Returns real companies based on AI's training data.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { SearchResult, ProviderResponse } from '../types';

@Injectable()
export class AiFallbackProvider {
  private readonly logger = new Logger(AiFallbackProvider.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Generate competitor suggestions using AI
   */
  async search(
    keywords: string[],
    regions: string[],
    options: { limit?: number; industry?: string } = {},
  ): Promise<ProviderResponse> {
    const limit = options.limit || 10;

    // Map region codes to names
    const regionNames = regions.map(code => this.getRegionName(code)).join(', ');
    const keywordStr = keywords.join(', ');
    const industry = options.industry || keywords[0] || 'technology';

    const prompt = `You are a business research expert. List ${limit} REAL companies that are:
- In the ${industry} industry
- Operating in or targeting: ${regionNames}
- Related to: ${keywordStr}

For each company, provide:
1. name: Official company name
2. website: Their actual website URL (must be real and working)
3. description: 2-3 sentence description of what they do
4. country: ISO 2-letter country code where they're headquartered

IMPORTANT:
- Only include REAL companies that actually exist
- Websites must be real, working URLs
- Focus on startups and growth-stage companies
- Prioritize companies from the specified regions

Return ONLY a valid JSON array, no markdown, no explanations.
Example format:
[
  {
    "name": "Company Name",
    "website": "https://company.com",
    "description": "Description here",
    "country": "NG"
  }
]`;

    try {
      this.logger.log(`[AI Fallback] Generating ${limit} competitors for ${industry} in ${regionNames}`);

      const response = await this.aiService.chat([
        { 
          role: 'system', 
          content: 'You are a business research expert. Return only valid JSON arrays.' 
        },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.3, // Lower temperature for more factual responses
        maxTokens: 2000,
      });

      const content = response.content || '';
      
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('[AI Fallback] No JSON array found in response');
        return {
          success: false,
          results: [],
          provider: 'ai',
          error: 'Invalid AI response format',
        };
      }

      const companies = JSON.parse(jsonMatch[0]);
      
      // Convert to SearchResult format
      const results: SearchResult[] = companies.map((c: any) => ({
        url: c.website || '',
        title: c.name || '',
        snippet: c.description || '',
        content: `${c.name} - ${c.description}. Country: ${c.country}`,
      })).filter((r: SearchResult) => r.url && r.title);

      this.logger.log(`[AI Fallback] Generated ${results.length} competitor suggestions`);

      return {
        success: true,
        results,
        provider: 'ai',
      };

    } catch (error) {
      this.logger.error(`[AI Fallback] Failed: ${error.message}`);
      return {
        success: false,
        results: [],
        provider: 'ai',
        error: error.message,
      };
    }
  }

  /**
   * Map ISO country codes to region names
   */
  private getRegionName(code: string): string {
    const regions: Record<string, string> = {
      'NG': 'Nigeria',
      'KE': 'Kenya',
      'CI': 'Ivory Coast',
      'GH': 'Ghana',
      'ZA': 'South Africa',
      'EG': 'Egypt',
      'MA': 'Morocco',
      'TZ': 'Tanzania',
      'UG': 'Uganda',
      'RW': 'Rwanda',
      'SN': 'Senegal',
      'ET': 'Ethiopia',
      'US': 'United States',
      'UK': 'United Kingdom',
      'GB': 'United Kingdom',
      'FR': 'France',
      'DE': 'Germany',
    };
    return regions[code.toUpperCase()] || code;
  }
}
