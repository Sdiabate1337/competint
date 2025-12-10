import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirecrawlService } from './firecrawl.service';

describe('FirecrawlService', () => {
    let service: FirecrawlService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirecrawlService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => {
                            if (key === 'FIRECRAWL_API_KEY') {
                                return process.env.FIRECRAWL_API_KEY || null;
                            }
                            return null;
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<FirecrawlService>(FirecrawlService);
    });

    describe('search', () => {
        it('should return mock results when API key is not configured', async () => {
            const results = await service.search('fintech startup Nigeria');
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('url');
            expect(results[0]).toHaveProperty('title');
            expect(results[0]).toHaveProperty('markdown');
        });

        it('should return results with context', async () => {
            const results = await service.searchWithContext(
                'mobile payment',
                { region: 'Kenya', industry: 'Fintech' },
                { limit: 5 }
            );
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('scrape', () => {
        it('should return mock scraped page when API key is not configured', async () => {
            const page = await service.scrapePage('https://example.com');
            
            expect(page).toBeDefined();
            expect(page).toHaveProperty('url');
            expect(page).toHaveProperty('markdown');
            expect(page).toHaveProperty('title');
        });

        it('should return mock extracted data when API key is not configured', async () => {
            const data = await service.scrapeWithExtraction('https://example-fintech.com');
            
            expect(data).toBeDefined();
            expect(data).toHaveProperty('company_name');
            expect(data).toHaveProperty('description');
            expect(data).toHaveProperty('social_links');
        });
    });

    describe('crawl', () => {
        it('should return mock crawl results when API key is not configured', async () => {
            const result = await service.crawlSite('https://example.com', { maxPages: 3 });
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('pages');
            expect(result).toHaveProperty('totalPages');
            expect(result.pages.length).toBeGreaterThan(0);
        });
    });

    describe('extractSocialLinks', () => {
        it('should extract social links from page content', async () => {
            const links = await service.extractSocialLinks('https://example.com');
            
            expect(links).toBeDefined();
            expect(typeof links).toBe('object');
        });
    });
});
