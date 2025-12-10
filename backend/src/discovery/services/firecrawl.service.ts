import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

export interface ScrapedPage {
    url: string;
    title?: string;
    markdown?: string;
    html?: string;
    metadata?: {
        title?: string;
        description?: string;
        ogImage?: string;
        favicon?: string;
    };
    extractedData?: any;
}

export interface CrawlResult {
    pages: ScrapedPage[];
    totalPages: number;
}

export interface SearchResult {
    url: string;
    title: string;
    description?: string;
    markdown?: string;
    metadata?: any;
}

export interface CompanyExtractedData {
    company_name: string;
    tagline?: string;
    description?: string;
    founding_year?: number;
    headquarters?: string;
    employee_count?: string;
    business_model?: string;
    value_proposition?: string;
    products_services?: string[];
    target_market?: string;
    pricing_model?: string;
    
    // Team
    founders?: { name: string; role: string; linkedin?: string }[];
    leadership_team?: { name: string; role: string }[];
    
    // Funding
    funding_stage?: string;
    total_funding?: string;
    investors?: string[];
    
    // Social & Contact
    social_links?: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        crunchbase?: string;
        github?: string;
    };
    contact_email?: string;
    phone?: string;
    
    // Tech & Features
    technologies?: string[];
    features?: string[];
    integrations?: string[];
    
    // Traction
    customers?: string[];
    partnerships?: string[];
    awards?: string[];
    press_mentions?: string[];
}

// Zod schema for structured extraction
const CompanySchema = z.object({
    company_name: z.string(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    founding_year: z.number().optional(),
    headquarters: z.string().optional(),
    employee_count: z.string().optional(),
    business_model: z.string().optional(),
    value_proposition: z.string().optional(),
    products_services: z.array(z.string()).optional(),
    target_market: z.string().optional(),
    pricing_model: z.string().optional(),
    founders: z.array(z.object({
        name: z.string(),
        role: z.string().optional(),
        linkedin: z.string().optional(),
    })).optional(),
    funding_stage: z.string().optional(),
    total_funding: z.string().optional(),
    investors: z.array(z.string()).optional(),
    social_links: z.object({
        linkedin: z.string().optional(),
        twitter: z.string().optional(),
        facebook: z.string().optional(),
        instagram: z.string().optional(),
        youtube: z.string().optional(),
        crunchbase: z.string().optional(),
        github: z.string().optional(),
    }).optional(),
    contact_email: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    customers: z.array(z.string()).optional(),
    partnerships: z.array(z.string()).optional(),
});

@Injectable()
export class FirecrawlService {
    private readonly logger = new Logger(FirecrawlService.name);
    private readonly firecrawl: Firecrawl | null = null;
    private readonly apiKey: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('FIRECRAWL_API_KEY') || '';

        if (this.apiKey) {
            this.firecrawl = new Firecrawl({ apiKey: this.apiKey });
            this.logger.log('Firecrawl initialized');
        } else {
            this.logger.warn('FIRECRAWL_API_KEY not configured - Firecrawl features will use mock data');
        }
    }

    /**
     * Search the web using Firecrawl's search API
     */
    async search(query: string, options?: {
        limit?: number;
        scrapeResults?: boolean;
    }): Promise<SearchResult[]> {
        if (!this.firecrawl) {
            return this.mockSearchResults(query);
        }

        try {
            this.logger.log(`Firecrawl search: "${query}"`);

            const results = await this.firecrawl.search(query, {
                limit: options?.limit || 10,
                scrapeOptions: options?.scrapeResults ? {
                    formats: ['markdown'],
                } : undefined,
            }) as any;

            // Handle different response structures
            const webResults = results?.data?.web || results?.web || results?.data || [];
            
            if (!webResults || webResults.length === 0) {
                return [];
            }

            return webResults.map((result: any) => ({
                url: result.url,
                title: result.title,
                description: result.description,
                markdown: result.markdown,
                metadata: result.metadata,
            }));
        } catch (error) {
            this.logger.error(`Firecrawl search error: ${error.message}`);
            return [];
        }
    }

    /**
     * Search with context (region, industry) - enhanced query
     */
    async searchWithContext(query: string, context: {
        region?: string;
        industry?: string;
    }, options?: {
        limit?: number;
    }): Promise<SearchResult[]> {
        let enhancedQuery = query;

        if (context.region) {
            enhancedQuery += ` in ${context.region}`;
        }
        if (context.industry) {
            enhancedQuery += ` ${context.industry}`;
        }

        return this.search(enhancedQuery, {
            limit: options?.limit || 10,
            scrapeResults: true, // Get full content for AI extraction
        });
    }

    /**
     * Scrape une seule page avec extraction structurée
     */
    async scrapePage(url: string): Promise<ScrapedPage | null> {
        if (!this.firecrawl) {
            return this.mockScrapePage(url);
        }

        try {
            this.logger.log(`Scraping page: ${url}`);

            const result = await this.firecrawl.scrape(url, {
                formats: ['markdown', 'html'],
            });

            return {
                url,
                title: result.metadata?.title,
                markdown: result.markdown,
                html: result.html,
                metadata: result.metadata,
            };
        } catch (error) {
            this.logger.error(`Firecrawl scrape error: ${error.message}`);
            return null;
        }
    }

    /**
     * Scrape avec extraction structurée selon un schema Zod
     */
    async scrapeWithExtraction(url: string): Promise<CompanyExtractedData | null> {
        if (!this.firecrawl) {
            return this.mockExtractedData(url);
        }

        try {
            this.logger.log(`Scraping with extraction: ${url}`);

            // Use 'json' format with Zod schema for structured extraction
            const result = await this.firecrawl.scrape(url, {
                formats: [
                    'markdown',
                    {
                        type: 'json',
                        schema: CompanySchema,
                    },
                ],
            });

            if (!result.json) {
                this.logger.warn(`Failed to extract data from ${url}`);
                return null;
            }

            return result.json as CompanyExtractedData;
        } catch (error) {
            this.logger.error(`Firecrawl extraction error: ${error.message}`);
            return null;
        }
    }

    /**
     * Scrape avec un prompt libre (sans schema)
     * Firecrawl's LLM choisit la structure
     */
    async scrapeWithPrompt(url: string, prompt: string): Promise<any> {
        if (!this.firecrawl) {
            return this.mockExtractedData(url);
        }

        try {
            this.logger.log(`Scraping with prompt: ${url}`);

            const result = await this.firecrawl.scrape(url, {
                formats: [
                    {
                        type: 'json',
                        prompt,
                    },
                ],
            });

            return result.json;
        } catch (error) {
            this.logger.error(`Firecrawl prompt extraction error: ${error.message}`);
            return null;
        }
    }

    /**
     * Crawl un site entier (plusieurs pages)
     */
    async crawlSite(url: string, options?: {
        maxPages?: number;
        includePaths?: string[];
    }): Promise<CrawlResult> {
        if (!this.firecrawl) {
            return this.mockCrawlSite(url);
        }

        try {
            this.logger.log(`Crawling site: ${url} (max ${options?.maxPages || 10} pages)`);

            const result = await this.firecrawl.crawl(url, {
                limit: options?.maxPages || 10,
                includePaths: options?.includePaths || ['/about', '/team', '/pricing', '/product', '/company'],
                scrapeOptions: {
                    formats: ['markdown'],
                },
            });

            if (!result.data || result.data.length === 0) {
                this.logger.warn(`Failed to crawl ${url}`);
                return { pages: [], totalPages: 0 };
            }

            const pages: ScrapedPage[] = result.data.map((page: any) => ({
                url: page.url || page.sourceURL,
                title: page.metadata?.title,
                markdown: page.markdown,
                metadata: page.metadata,
            }));

            return {
                pages,
                totalPages: pages.length,
            };
        } catch (error) {
            this.logger.error(`Firecrawl crawl error: ${error.message}`);
            return { pages: [], totalPages: 0 };
        }
    }

    /**
     * Extraire les liens sociaux d'une page
     */
    async extractSocialLinks(url: string): Promise<CompanyExtractedData['social_links']> {
        const page = await this.scrapePage(url);
        
        if (!page?.html) {
            return {};
        }

        const socialLinks: CompanyExtractedData['social_links'] = {};

        // Patterns pour détecter les liens sociaux
        const patterns = {
            linkedin: /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+/gi,
            twitter: /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/gi,
            facebook: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
            instagram: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi,
            youtube: /https?:\/\/(www\.)?youtube\.com\/(channel|c|@)[a-zA-Z0-9_-]+/gi,
            crunchbase: /https?:\/\/(www\.)?crunchbase\.com\/organization\/[a-zA-Z0-9_-]+/gi,
            github: /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+/gi,
        };

        const content = page.html + ' ' + (page.markdown || '');

        for (const [platform, pattern] of Object.entries(patterns)) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                socialLinks[platform as keyof typeof socialLinks] = matches[0];
            }
        }

        return socialLinks;
    }

    // ==================== MOCK DATA FOR DEVELOPMENT ====================

    private mockScrapePage(url: string): ScrapedPage {
        this.logger.warn(`Using mock data for scraping: ${url}`);
        
        return {
            url,
            title: 'Mock Company - Fintech Innovation',
            markdown: `
# Mock Company

## About Us
We are a leading fintech startup revolutionizing payments in Africa.

## Our Team
- **John Doe** - CEO & Co-founder
- **Jane Smith** - CTO & Co-founder

## Products
- Mobile Payments
- Business Banking
- API Platform

## Contact
Email: hello@mockcompany.com
LinkedIn: linkedin.com/company/mockcompany
Twitter: @mockcompany
            `,
            metadata: {
                title: 'Mock Company - Fintech Innovation',
                description: 'Leading fintech startup in Africa',
            },
        };
    }

    private mockExtractedData(url: string): CompanyExtractedData {
        this.logger.warn(`Using mock extracted data for: ${url}`);
        
        const domain = new URL(url).hostname.replace('www.', '');
        const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

        return {
            company_name: companyName,
            tagline: 'Innovating financial services in Africa',
            description: `${companyName} is a fintech company focused on digital payments and financial inclusion across Africa.`,
            founding_year: 2021,
            headquarters: 'Lagos, Nigeria',
            employee_count: '50-100',
            business_model: 'B2B SaaS',
            value_proposition: 'Seamless cross-border payments for African businesses',
            products_services: ['Mobile Payments', 'Business Banking', 'API Platform'],
            target_market: 'SMEs in West Africa',
            pricing_model: 'Transaction fees + Subscription',
            founders: [
                { name: 'John Doe', role: 'CEO', linkedin: 'linkedin.com/in/johndoe' },
                { name: 'Jane Smith', role: 'CTO', linkedin: 'linkedin.com/in/janesmith' },
            ],
            funding_stage: 'Series A',
            total_funding: '$5M',
            investors: ['Y Combinator', 'Sequoia Africa', 'Local Angels'],
            social_links: {
                linkedin: `https://linkedin.com/company/${companyName.toLowerCase()}`,
                twitter: `https://twitter.com/${companyName.toLowerCase()}`,
                facebook: `https://facebook.com/${companyName.toLowerCase()}`,
                crunchbase: `https://crunchbase.com/organization/${companyName.toLowerCase()}`,
            },
            contact_email: `hello@${domain}`,
            technologies: ['React Native', 'Node.js', 'PostgreSQL', 'AWS'],
            features: ['Instant transfers', 'Multi-currency', 'API access', 'Analytics dashboard'],
            customers: ['Company A', 'Company B', 'Company C'],
            partnerships: ['Visa', 'Mastercard', 'Local Banks'],
        };
    }

    private mockCrawlSite(url: string): CrawlResult {
        this.logger.warn(`Using mock crawl data for: ${url}`);

        return {
            pages: [
                this.mockScrapePage(url),
                {
                    url: `${url}/about`,
                    title: 'About Us',
                    markdown: '# About Us\n\nWe are building the future of finance in Africa.',
                },
                {
                    url: `${url}/team`,
                    title: 'Our Team',
                    markdown: '# Our Team\n\n- CEO: John Doe\n- CTO: Jane Smith\n- COO: Bob Johnson',
                },
            ],
            totalPages: 3,
        };
    }

    private mockSearchResults(query: string): SearchResult[] {
        this.logger.warn(`Using mock search results for: ${query}`);

        return [
            {
                url: `https://example-fintech-${Date.now()}.com`,
                title: `${query} - Leading Fintech Startup`,
                description: `A fintech company focused on ${query} in Africa. Founded in 2022.`,
                markdown: `# ${query} Startup\n\nWe are revolutionizing ${query} in Africa.\n\n## About\nFounded in 2022, we provide digital payment solutions.\n\n## Team\n- CEO: John Doe\n- CTO: Jane Smith`,
            },
            {
                url: `https://paytech-${Date.now()}.africa`,
                title: `PayTech Africa - ${query} Solutions`,
                description: `Digital payment platform serving businesses across Africa with ${query} services.`,
                markdown: `# PayTech Africa\n\n## Services\n- Mobile Payments\n- Business Banking\n- API Platform\n\n## Funding\nSeries A: $3M`,
            },
            {
                url: `https://afribank-${Date.now()}.com`,
                title: `AfriBanking - ${query} Platform`,
                description: `Banking platform for ${query} in West Africa.`,
                markdown: `# AfriBanking\n\nDigital banking for the next billion.\n\n## Products\n- Savings accounts\n- Business loans\n- Payment processing`,
            },
        ];
    }
}
