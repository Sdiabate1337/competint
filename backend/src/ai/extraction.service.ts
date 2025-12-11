import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

export interface CompetitorData {
    name: string;
    website?: string;
    description?: string;
    tagline?: string;
    business_model?: string;
    value_proposition?: string;
    industry?: string;
    country?: string;
    headquarters?: string;
    founded_year?: number;
    founders?: { name: string; role?: string; linkedin?: string }[];
    leadership_team?: { name: string; role: string }[];
    funding_raised?: number;
    funding_stage?: string;
    investors?: string[];
    employee_count?: number;
    technologies?: string[];
    products_services?: string[];
    target_market?: string;
    pricing_model?: string;
    customers?: string[];
    partnerships?: string[];
    social_links?: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        crunchbase?: string;
        github?: string;
    };
    strengths?: string[];
    weaknesses?: string[];
    key_differentiators?: string[];
    growth_signals?: string[];
}

@Injectable()
export class ExtractionService {
    private readonly logger = new Logger(ExtractionService.name);

    constructor(private readonly aiService: AiService) { }

    /**
     * Extract comprehensive competitor data from markdown/text content
     * This is the main extraction method used during discovery
     */
    async extractCompetitorData(content: string, sourceUrl?: string): Promise<CompetitorData | null> {
        // First, extract social links directly from the content (more reliable than AI)
        const socialLinks = this.extractSocialLinksFromContent(content, sourceUrl);
        
        const schema = {
            name: 'string (required - company name)',
            website: 'string (main website URL)',
            tagline: 'string (company slogan or one-liner)',
            description: 'string (2-3 sentences describing what the company does)',
            business_model: 'string (SaaS, Marketplace, E-commerce, B2B, B2C, Fintech, etc.)',
            value_proposition: 'string (main problem they solve and how)',
            industry: 'string (primary industry: Fintech, E-commerce, Healthcare, EdTech, etc.)',
            country: 'string (ISO country code where HQ is located, e.g., US, NG, KE, GB)',
            headquarters: 'string (city and country of headquarters)',
            founded_year: 'number (year the company was founded)',
            founders: 'array of objects with {name, role, linkedin} - founder information',
            leadership_team: 'array of objects with {name, role} - key executives',
            funding_raised: 'number (total funding in USD, e.g., 50000000 for $50M)',
            funding_stage: 'string (Seed, Series A, Series B, Series C, etc.)',
            investors: 'array of strings (notable investors and VCs)',
            employee_count: 'number (approximate number of employees)',
            technologies: 'array of strings (tech stack, programming languages, frameworks)',
            products_services: 'array of strings (main products or services offered)',
            target_market: 'string (who are their customers - SMBs, Enterprise, Consumers, etc.)',
            pricing_model: 'string (Freemium, Subscription, Pay-per-use, etc.)',
            customers: 'array of strings (notable customers or case studies mentioned)',
            partnerships: 'array of strings (strategic partners mentioned)',
            strengths: 'array of strings (competitive advantages, what they do well)',
            weaknesses: 'array of strings (potential weaknesses or limitations)',
            key_differentiators: 'array of strings (what makes them unique vs competitors)',
            growth_signals: 'array of strings (indicators of growth: new funding, hiring, expansion)',
        };

        try {
            this.logger.log(`Extracting comprehensive competitor data from content (${content.length} chars)`);

            const extracted = await this.aiService.extractStructuredData(content, schema);

            if (!extracted || !extracted.name) {
                this.logger.warn('Failed to extract valid competitor data');
                return null;
            }

            // Add source URL if provided and not already present
            if (sourceUrl && !extracted.website) {
                extracted.website = this.extractMainDomain(sourceUrl);
            }

            // Merge extracted social links with AI-extracted ones (prefer direct extraction)
            extracted.social_links = {
                ...extracted.social_links,
                ...socialLinks,
            };

            // Clean up and validate social links
            if (extracted.social_links) {
                extracted.social_links = this.validateSocialLinks(extracted.social_links);
            }

            return extracted;
        } catch (error) {
            this.logger.error(`Extraction error: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract social media links directly from content using regex
     * More reliable than AI extraction for URLs
     */
    private extractSocialLinksFromContent(content: string, sourceUrl?: string): CompetitorData['social_links'] {
        const links: CompetitorData['social_links'] = {};

        // LinkedIn company page
        const linkedinMatch = content.match(/https?:\/\/(www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/gi);
        if (linkedinMatch && linkedinMatch.length > 0) {
            links.linkedin = linkedinMatch[0];
        }

        // Twitter/X
        const twitterMatch = content.match(/https?:\/\/(www\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)(?![\/]intent)/gi);
        if (twitterMatch && twitterMatch.length > 0) {
            // Filter out intent links and generic pages
            const validTwitter = twitterMatch.find(url => 
                !url.includes('/intent') && 
                !url.includes('/share') &&
                !url.includes('/home')
            );
            if (validTwitter) links.twitter = validTwitter;
        }

        // Facebook
        const facebookMatch = content.match(/https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9._-]+)/gi);
        if (facebookMatch && facebookMatch.length > 0) {
            const validFacebook = facebookMatch.find(url => 
                !url.includes('/sharer') && 
                !url.includes('/share')
            );
            if (validFacebook) links.facebook = validFacebook;
        }

        // Instagram
        const instagramMatch = content.match(/https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi);
        if (instagramMatch && instagramMatch.length > 0) {
            links.instagram = instagramMatch[0];
        }

        // YouTube
        const youtubeMatch = content.match(/https?:\/\/(www\.)?(youtube\.com\/(c\/|channel\/|user\/|@)?[a-zA-Z0-9_-]+)/gi);
        if (youtubeMatch && youtubeMatch.length > 0) {
            links.youtube = youtubeMatch[0];
        }

        // Crunchbase
        const crunchbaseMatch = content.match(/https?:\/\/(www\.)?crunchbase\.com\/organization\/([a-zA-Z0-9_-]+)/gi);
        if (crunchbaseMatch && crunchbaseMatch.length > 0) {
            links.crunchbase = crunchbaseMatch[0];
        }

        // GitHub
        const githubMatch = content.match(/https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9_-]+)/gi);
        if (githubMatch && githubMatch.length > 0) {
            links.github = githubMatch[0];
        }

        return links;
    }

    /**
     * Validate and clean social links
     */
    private validateSocialLinks(links: CompetitorData['social_links']): CompetitorData['social_links'] {
        const validated: CompetitorData['social_links'] = {};

        if (links?.linkedin && links.linkedin.includes('linkedin.com/company/')) {
            validated.linkedin = links.linkedin;
        }
        if (links?.twitter && (links.twitter.includes('twitter.com/') || links.twitter.includes('x.com/'))) {
            // Exclude intent/share links
            if (!links.twitter.includes('/intent') && !links.twitter.includes('/share')) {
                validated.twitter = links.twitter;
            }
        }
        if (links?.facebook && links.facebook.includes('facebook.com/')) {
            if (!links.facebook.includes('/sharer')) {
                validated.facebook = links.facebook;
            }
        }
        if (links?.instagram && links.instagram.includes('instagram.com/')) {
            validated.instagram = links.instagram;
        }
        if (links?.youtube && links.youtube.includes('youtube.com/')) {
            validated.youtube = links.youtube;
        }
        if (links?.crunchbase && links.crunchbase.includes('crunchbase.com/')) {
            validated.crunchbase = links.crunchbase;
        }
        if (links?.github && links.github.includes('github.com/')) {
            validated.github = links.github;
        }

        return validated;
    }

    /**
     * Extract main domain from a URL
     */
    private extractMainDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}`;
        } catch {
            return url;
        }
    }

    async generateCompetitorEmbedding(competitor: CompetitorData): Promise<number[]> {
        // Combine relevant fields for embedding
        const textForEmbedding = [
            competitor.name,
            competitor.description,
            competitor.value_proposition,
            competitor.business_model,
            competitor.industry,
        ]
            .filter(Boolean)
            .join(' | ');

        try {
            return await this.aiService.generateEmbedding(textForEmbedding);
        } catch (error) {
            this.logger.error(`Failed to generate embedding: ${error.message}`);
            throw error;
        }
    }

    /**
     * BATCH EXTRACTION - Un seul appel AI pour extraire plusieurs competitors
     * Optimisé pour réduire les coûts API
     */
    async extractBatch(prompt: string): Promise<CompetitorData[]> {
        try {
            this.logger.log('Starting batch extraction...');
            
            const response = await this.aiService.chat([
                { 
                    role: 'system', 
                    content: `You are a competitive intelligence analyst. Extract company data accurately.
Return ONLY a valid JSON array of company objects. No explanations, no markdown.
If a field is unknown, use null. Skip articles, lists, or non-company pages.` 
                },
                { role: 'user', content: prompt },
            ], { 
                temperature: 0.2,
                maxTokens: 4000,
            });

            // Parse JSON from response
            const content = response.content?.trim() || '';
            
            this.logger.log(`AI response length: ${content.length} chars`);
            this.logger.debug(`AI response preview: ${content.substring(0, 500)}`);
            
            // Find JSON array in response
            const jsonStart = content.indexOf('[');
            const jsonEnd = content.lastIndexOf(']');
            
            if (jsonStart === -1 || jsonEnd === -1) {
                this.logger.warn(`No JSON array found in batch response. Content: ${content.substring(0, 200)}`);
                return [];
            }

            const jsonStr = content.substring(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(jsonStr);

            if (!Array.isArray(parsed)) {
                this.logger.warn('Batch response is not an array');
                return [];
            }

            this.logger.log(`Batch extracted ${parsed.length} companies`);
            return parsed;

        } catch (error) {
            this.logger.error(`Batch extraction error: ${error.message}`);
            throw error;
        }
    }
}
