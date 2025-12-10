import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService, CompanyExtractedData, SearchResult } from './firecrawl.service';
import { SocialMediaService, SocialMediaProfile, SocialMediaMetrics } from './social-media.service';
import { AiService } from '../../ai/ai.service';

export interface EnrichedCompetitor {
    // Basic Info
    name: string;
    website?: string;
    tagline?: string;
    description?: string;
    
    // Company Details
    founding_year?: number;
    headquarters?: string;
    country?: string;
    region?: string;
    employee_count?: string;
    
    // Business
    business_model?: string;
    value_proposition?: string;
    products_services?: string[];
    target_market?: string;
    pricing_model?: string;
    industry?: string;
    
    // Team
    founders?: { name: string; role: string; linkedin?: string }[];
    leadership_team?: { name: string; role: string }[];
    
    // Funding
    funding_stage?: string;
    total_funding?: string;
    funding_amount_usd?: number;
    investors?: string[];
    
    // Social Media
    social_links?: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        crunchbase?: string;
        github?: string;
    };
    social_metrics?: SocialMediaMetrics;
    
    // Contact
    contact_email?: string;
    phone?: string;
    
    // Tech & Product
    technologies?: string[];
    features?: string[];
    integrations?: string[];
    
    // Traction & Credibility
    customers?: string[];
    partnerships?: string[];
    awards?: string[];
    press_mentions?: string[];
    
    // AI Analysis
    competitive_analysis?: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    };
    market_positioning?: string;
    growth_signals?: string[];
    risk_factors?: string[];
    
    // Metadata
    data_sources: string[];
    enrichment_date: string;
    confidence_score: number; // 0-100
    data_completeness: number; // 0-100
}

@Injectable()
export class EnrichmentService {
    private readonly logger = new Logger(EnrichmentService.name);

    constructor(
        private readonly firecrawlService: FirecrawlService,
        private readonly socialMediaService: SocialMediaService,
        private readonly aiService: AiService,
    ) {}

    /**
     * Enrichir complètement un concurrent à partir de son URL
     */
    async enrichCompetitor(
        url: string,
        initialData?: Partial<EnrichedCompetitor>,
        options?: {
            includeSocialMedia?: boolean;
            includeAiAnalysis?: boolean;
            crawlDepth?: number;
        }
    ): Promise<EnrichedCompetitor> {
        const startTime = Date.now();
        this.logger.log(`Starting enrichment for: ${url}`);

        const dataSources: string[] = ['website'];
        let extractedData: any = null;
        let additionalContent = '';
        
        // 1. Try to scrape website with structured extraction
        try {
            extractedData = await this.firecrawlService.scrapeWithExtraction(url);
            this.logger.log(`Extracted data: ${JSON.stringify(extractedData)}`);
        } catch (error) {
            this.logger.warn(`Firecrawl extraction failed: ${error.message}`);
        }
        
        // 2. Try to crawl additional pages for more context
        if (options?.crawlDepth && options.crawlDepth > 1) {
            try {
                const crawlResult = await this.firecrawlService.crawlSite(url, {
                    maxPages: options.crawlDepth,
                });
                additionalContent = crawlResult.pages.map(p => p.markdown).join('\n\n');
                if (crawlResult.totalPages > 0) {
                    dataSources.push('website_crawl');
                }
            } catch (error) {
                this.logger.warn(`Crawl failed: ${error.message}`);
            }
        }

        // 3. Extract social links - try multiple methods
        let socialLinks = extractedData?.social_links || {};
        
        // Try to extract from website if not found
        if (!socialLinks.linkedin && !socialLinks.twitter) {
            try {
                const extractedSocial = await this.firecrawlService.extractSocialLinks(url);
                socialLinks = { ...socialLinks, ...extractedSocial };
            } catch (error) {
                this.logger.warn(`Social link extraction failed: ${error.message}`);
            }
        }

        // Generate social links from company name if still empty
        if (Object.keys(socialLinks).length === 0 && initialData?.name) {
            const companySlug = initialData.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            socialLinks = {
                linkedin: `https://linkedin.com/company/${companySlug}`,
                twitter: `https://twitter.com/${companySlug}`,
                facebook: `https://facebook.com/${companySlug}`,
                instagram: `https://instagram.com/${companySlug}`,
            };
            this.logger.log(`Generated social links for ${initialData.name}: ${JSON.stringify(socialLinks)}`);
        }

        // 4. Enrich with social media data
        let socialProfile: SocialMediaProfile = {};
        let socialMetrics: SocialMediaMetrics | undefined;
        
        if (options?.includeSocialMedia !== false && Object.keys(socialLinks).length > 0) {
            try {
                socialProfile = await this.socialMediaService.enrichWithSocialData(socialLinks);
                socialMetrics = this.socialMediaService.calculateSocialMetrics(socialProfile);
                
                if (socialProfile.linkedin) dataSources.push('linkedin');
                if (socialProfile.twitter) dataSources.push('twitter');
                if (socialProfile.facebook) dataSources.push('facebook');
            } catch (error) {
                this.logger.warn(`Social media enrichment failed: ${error.message}`);
                // Still keep the social links even if enrichment failed
                socialProfile = { social_links: socialLinks } as any;
            }
        }

        // 5. Merge all data
        const mergedData = this.mergeCompetitorData(
            initialData || {},
            extractedData || {},
            socialProfile,
            url,
        );

        // Ensure social links are in merged data
        if (!mergedData.social_links || Object.keys(mergedData.social_links).length === 0) {
            mergedData.social_links = socialLinks;
        }

        // 6. AI Analysis (SWOT, positioning, etc.)
        let aiAnalysis: Partial<EnrichedCompetitor> = {};
        if (options?.includeAiAnalysis !== false) {
            try {
                aiAnalysis = await this.generateAiAnalysis(mergedData, additionalContent);
                dataSources.push('ai_analysis');
            } catch (error) {
                this.logger.warn(`AI analysis failed: ${error.message}`);
                // Generate basic analysis from available data
                aiAnalysis = this.generateBasicAnalysis(mergedData);
            }
        }

        // 7. Calculate confidence and completeness scores
        const completeness = this.calculateDataCompleteness(mergedData);
        const confidence = this.calculateConfidenceScore(mergedData, dataSources);

        const enrichedCompetitor: EnrichedCompetitor = {
            ...mergedData,
            ...aiAnalysis,
            social_links: socialLinks,
            social_metrics: socialMetrics,
            data_sources: dataSources,
            enrichment_date: new Date().toISOString(),
            confidence_score: confidence,
            data_completeness: completeness,
        };

        const duration = Date.now() - startTime;
        this.logger.log(`Enrichment completed for ${enrichedCompetitor.name} in ${duration}ms (completeness: ${completeness}%)`);

        return enrichedCompetitor;
    }

    /**
     * Generate basic analysis when AI fails
     */
    private generateBasicAnalysis(data: Partial<EnrichedCompetitor>): Partial<EnrichedCompetitor> {
        return {
            competitive_analysis: {
                strengths: data.description ? ['Established market presence'] : [],
                weaknesses: ['Limited data available for analysis'],
                opportunities: ['Market expansion potential'],
                threats: ['Competitive market landscape'],
            },
            market_positioning: data.business_model || 'Digital platform',
            growth_signals: data.funding_stage ? [`${data.funding_stage} funding secured`] : [],
            risk_factors: ['Market competition'],
        };
    }

    /**
     * Enrichir plusieurs concurrents en batch
     */
    async enrichBatch(
        items: { url: string; initialData?: Partial<EnrichedCompetitor> }[],
        options?: {
            includeSocialMedia?: boolean;
            includeAiAnalysis?: boolean;
            delayBetweenRequests?: number;
        }
    ): Promise<EnrichedCompetitor[]> {
        const results: EnrichedCompetitor[] = [];
        const delay = options?.delayBetweenRequests || 2000;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            try {
                const enriched = await this.enrichCompetitor(
                    item.url,
                    item.initialData,
                    options,
                );
                results.push(enriched);
            } catch (error) {
                this.logger.error(`Failed to enrich ${item.url}: ${error.message}`);
            }

            // Rate limiting
            if (i < items.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }

    /**
     * Enrichir à partir des résultats de recherche Firecrawl
     */
    async enrichFromSearchResults(
        results: SearchResult[],
        options?: {
            includeSocialMedia?: boolean;
            includeAiAnalysis?: boolean;
        }
    ): Promise<EnrichedCompetitor[]> {
        const items = results.map(result => ({
            url: result.url,
            initialData: {
                name: this.extractCompanyNameFromTitle(result.title),
                description: result.markdown || result.description,
            },
        }));

        return this.enrichBatch(items, options);
    }

    // ==================== PRIVATE HELPERS ====================

    private mergeCompetitorData(
        initial: Partial<EnrichedCompetitor>,
        extracted: Partial<CompanyExtractedData>,
        social: SocialMediaProfile,
        url: string,
    ): EnrichedCompetitor {
        // Parse funding amount to USD
        let fundingAmountUsd: number | undefined;
        if (extracted.total_funding) {
            const match = extracted.total_funding.match(/\$?([\d.]+)\s*(M|K|B)?/i);
            if (match) {
                let amount = parseFloat(match[1]);
                const multiplier = match[2]?.toUpperCase();
                if (multiplier === 'K') amount *= 1000;
                else if (multiplier === 'M') amount *= 1000000;
                else if (multiplier === 'B') amount *= 1000000000;
                fundingAmountUsd = amount;
            }
        }

        // Merge LinkedIn data
        const linkedinData = social.linkedin || {};

        return {
            name: extracted.company_name || initial.name || this.extractDomainName(url),
            website: url,
            tagline: extracted.tagline,
            description: extracted.description || initial.description || linkedinData.description,
            
            founding_year: extracted.founding_year || linkedinData.founded,
            headquarters: extracted.headquarters || linkedinData.headquarters,
            country: initial.country,
            region: initial.region,
            employee_count: extracted.employee_count || linkedinData.company_size,
            
            business_model: extracted.business_model || initial.business_model,
            value_proposition: extracted.value_proposition,
            products_services: extracted.products_services,
            target_market: extracted.target_market,
            pricing_model: extracted.pricing_model,
            industry: linkedinData.industry || initial.industry,
            
            founders: extracted.founders,
            leadership_team: extracted.leadership_team,
            
            funding_stage: extracted.funding_stage,
            total_funding: extracted.total_funding,
            funding_amount_usd: fundingAmountUsd,
            investors: extracted.investors,
            
            social_links: extracted.social_links,
            
            contact_email: extracted.contact_email,
            phone: extracted.phone,
            
            technologies: extracted.technologies || initial.technologies,
            features: extracted.features,
            integrations: extracted.integrations,
            
            customers: extracted.customers,
            partnerships: extracted.partnerships,
            awards: extracted.awards,
            press_mentions: extracted.press_mentions,
            
            data_sources: [],
            enrichment_date: new Date().toISOString(),
            confidence_score: 0,
            data_completeness: 0,
        };
    }

    private async generateAiAnalysis(
        competitor: Partial<EnrichedCompetitor>,
        additionalContent: string,
    ): Promise<Partial<EnrichedCompetitor>> {
        const prompt = `Analyze this competitor and provide strategic insights:

Company: ${competitor.name}
Description: ${competitor.description || 'N/A'}
Business Model: ${competitor.business_model || 'N/A'}
Industry: ${competitor.industry || 'N/A'}
Funding: ${competitor.total_funding || 'N/A'}
Products/Services: ${competitor.products_services?.join(', ') || 'N/A'}
Technologies: ${competitor.technologies?.join(', ') || 'N/A'}

Additional Context:
${additionalContent.substring(0, 2000)}

Provide analysis in JSON format:
{
    "competitive_analysis": {
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "opportunities": ["opportunity1", "opportunity2"],
        "threats": ["threat1", "threat2"]
    },
    "market_positioning": "Brief description of their market position",
    "growth_signals": ["signal1", "signal2"],
    "risk_factors": ["risk1", "risk2"]
}`;

        try {
            const response = await this.aiService.chat([
                { role: 'system', content: 'You are a competitive intelligence analyst. Provide concise, actionable insights.' },
                { role: 'user', content: prompt },
            ], { temperature: 0.3 });

            const parsed = JSON.parse(
                response.content.substring(
                    response.content.indexOf('{'),
                    response.content.lastIndexOf('}') + 1
                )
            );

            return parsed;
        } catch (error) {
            this.logger.warn(`AI analysis failed: ${error.message}`);
            return {};
        }
    }

    private calculateDataCompleteness(data: Partial<EnrichedCompetitor>): number {
        const importantFields = [
            'name', 'website', 'description', 'business_model', 'value_proposition',
            'industry', 'country', 'founding_year', 'employee_count', 'founders',
            'funding_stage', 'total_funding', 'social_links', 'technologies',
        ];

        const filledFields = importantFields.filter(field => {
            const value = data[field as keyof EnrichedCompetitor];
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object') return Object.keys(value || {}).length > 0;
            return value !== null && value !== undefined && value !== '';
        });

        return Math.round((filledFields.length / importantFields.length) * 100);
    }

    private calculateConfidenceScore(
        data: Partial<EnrichedCompetitor>,
        sources: string[],
    ): number {
        let score = 0;

        // Source diversity (max 40 points)
        score += Math.min(sources.length * 10, 40);

        // Data completeness bonus (max 30 points)
        const completeness = this.calculateDataCompleteness(data);
        score += Math.round(completeness * 0.3);

        // Verified data points (max 30 points)
        if (data.website) score += 5;
        if (data.social_links?.linkedin) score += 10;
        if (data.funding_stage) score += 5;
        if (data.founders && data.founders.length > 0) score += 5;
        if (data.technologies && data.technologies.length > 0) score += 5;

        return Math.min(score, 100);
    }

    private extractCompanyNameFromTitle(title: string): string {
        // Remove common suffixes
        return title
            .replace(/\s*[-|–—]\s*.+$/, '')
            .replace(/\s*\|.+$/, '')
            .replace(/\s*:.*$/, '')
            .trim();
    }

    private extractDomainName(url: string): string {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        } catch {
            return 'Unknown';
        }
    }
}
