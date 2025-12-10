import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { CreateDiscoveryRunDto } from './dto/create-discovery-run.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirecrawlService } from './services/firecrawl.service';
import { EnrichmentService } from './services/enrichment.service';

@Controller('discovery')
export class DiscoveryController {
    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly firecrawlService: FirecrawlService,
        private readonly enrichmentService: EnrichmentService,
    ) { }

    /**
     * Test endpoint - no auth required (DEV ONLY)
     * POST /api/discovery/test
     * Accepts full project data for intelligent competitor discovery
     */
    @Post('test')
    async testPipeline(@Body() body: {
        // New format with full project data
        projectId?: string;
        projectName?: string;
        description?: string;
        keywords?: string[];
        industries?: string[];
        regions?: string[];
        // Legacy format
        query?: string;
        region?: string;
        industry?: string;
    }) {
        // Build intelligent search query from project data
        const searchQuery = this.buildSearchQuery(body);
        const region = body.regions?.[0] || body.region || 'Global';
        const industry = body.industries?.[0] || body.industry;
        
        console.log(`[Discovery] Project: ${body.projectName || 'N/A'}`);
        console.log(`[Discovery] Query: "${searchQuery}"`);
        console.log(`[Discovery] Region: ${region}, Industry: ${industry || 'any'}`);
        
        // Step 1: Search with context
        const searchResults = await this.firecrawlService.searchWithContext(
            searchQuery,
            { region, industry: industry || undefined },
            { limit: 5 }
        );

        console.log(`[Discovery] Found ${searchResults.length} results`);

        if (searchResults.length === 0) {
            return { 
                success: false, 
                message: 'No results found', 
                searchQuery,
                region,
                projectName: body.projectName,
            };
        }

        // Step 2: Enrich first result with AI analysis
        const enriched = await this.enrichmentService.enrichCompetitor(
            searchResults[0].url,
            { name: searchResults[0].title, description: searchResults[0].description },
            { includeSocialMedia: false, includeAiAnalysis: true }
        );

        return {
            success: true,
            projectName: body.projectName,
            searchQuery,
            region,
            industry,
            searchResults: searchResults.map(r => ({
                title: r.title,
                url: r.url,
                description: r.description?.substring(0, 200),
            })),
            enrichedCompetitor: enriched,
        };
    }

    /**
     * Build an intelligent, highly specific search query from project data
     * The goal is to find DIRECT competitors, not generic companies in the same industry
     */
    private buildSearchQuery(body: {
        projectName?: string;
        description?: string;
        keywords?: string[];
        industries?: string[];
        regions?: string[];
        query?: string;
    }): string {
        // If legacy query is provided, use it
        if (body.query) {
            return body.query;
        }

        // Extract the core business model from description
        const businessModel = this.extractBusinessModel(body.description || '');
        
        // Build a highly specific query
        const queryParts: string[] = [];
        
        // Add the specific business model (most important)
        if (businessModel.core) {
            queryParts.push(businessModel.core);
        }
        
        // Add target market/vertical
        if (businessModel.vertical) {
            queryParts.push(businessModel.vertical);
        }
        
        // Add business type (B2B, B2C, etc.)
        if (businessModel.type) {
            queryParts.push(businessModel.type);
        }
        
        // Add user-defined keywords
        if (body.keywords && body.keywords.length > 0) {
            queryParts.push(body.keywords.join(' '));
        }
        
        // Add geographic context (Africa, West Africa, etc.)
        if (businessModel.geography) {
            queryParts.push(businessModel.geography);
        } else if (body.regions && body.regions.length > 0) {
            // Map region codes to meaningful names
            const regionName = this.getRegionName(body.regions);
            if (regionName) {
                queryParts.push(regionName);
            }
        }
        
        // Add "competitors" or "startups" to find similar companies
        queryParts.push('startup');
        
        // Fallback
        if (queryParts.length <= 1 && body.projectName) {
            queryParts.unshift(`${body.projectName} competitors`);
        }

        const finalQuery = queryParts.join(' ');
        console.log(`[Discovery] Built query: "${finalQuery}" from description`);
        return finalQuery;
    }

    /**
     * Extract detailed business model from description
     */
    private extractBusinessModel(description: string): {
        core: string | null;
        vertical: string | null;
        type: string | null;
        geography: string | null;
    } {
        const desc = description.toLowerCase();
        const result = {
            core: null as string | null,
            vertical: null as string | null,
            type: null as string | null,
            geography: null as string | null,
        };

        // Detect geography
        if (desc.includes('west africa')) result.geography = 'West Africa';
        else if (desc.includes('east africa')) result.geography = 'East Africa';
        else if (desc.includes('africa')) result.geography = 'Africa';
        else if (desc.includes('nigeria')) result.geography = 'Nigeria';
        else if (desc.includes('kenya')) result.geography = 'Kenya';
        else if (desc.includes('south africa')) result.geography = 'South Africa';

        // Detect business type
        if (desc.includes('b2b')) result.type = 'B2B';
        else if (desc.includes('b2c')) result.type = 'B2C';
        else if (desc.includes('wholesale')) result.type = 'B2B wholesale';

        // CONSTRUCTION / BUILDING MATERIALS
        if (desc.includes('construction') || desc.includes('building material') || desc.includes('hardware store') || desc.includes('cement') || desc.includes('builders')) {
            result.vertical = 'construction materials';
            
            if (desc.includes('marketplace') || desc.includes('platform') || desc.includes('connecting')) {
                result.core = 'construction materials marketplace';
            } else if (desc.includes('supply chain') || desc.includes('procurement')) {
                result.core = 'construction procurement platform';
            } else if (desc.includes('delivery')) {
                result.core = 'building materials delivery';
            } else {
                result.core = 'construction tech';
            }
            return result;
        }

        // NEOBANK / CHALLENGER BANK / DIGITAL BANK (check first - more specific)
        if (desc.includes('challenger bank') || desc.includes('neobank') || desc.includes('neo-bank') || 
            desc.includes('digital bank') || desc.includes('mobile bank') ||
            (desc.includes('digital account') && (desc.includes('savings') || desc.includes('payment'))) ||
            (desc.includes('mobile-first') && (desc.includes('financial') || desc.includes('bank')))) {
            
            result.vertical = 'neobank';
            result.type = 'B2C';
            
            if (desc.includes('merchant') || desc.includes('business')) {
                result.core = 'neobank digital banking app';
            } else {
                result.core = 'neobank challenger bank mobile banking';
            }
            
            // Add regional context for Africa
            if (desc.includes('africa') || desc.includes('francophone') || desc.includes('côte d\'ivoire') || 
                desc.includes('ivory coast') || desc.includes('senegal') || desc.includes('nigeria') || desc.includes('kenya')) {
                result.core += ' Africa';
            }
            return result;
        }

        // MOBILE MONEY (distinct from neobank - more telecom-focused)
        if (desc.includes('mobile money') || desc.includes('mobile wallet') || 
            (desc.includes('mobile') && desc.includes('money transfer'))) {
            result.vertical = 'mobile money';
            result.core = 'mobile money wallet Africa';
            return result;
        }

        // FINTECH / PAYMENTS (more generic)
        if (desc.includes('fintech') || desc.includes('payment') || desc.includes('banking')) {
            result.vertical = 'fintech';
            
            if (desc.includes('lending') || desc.includes('credit') || desc.includes('loan')) {
                result.core = 'digital lending platform';
            } else if (desc.includes('remittance') || desc.includes('transfer')) {
                result.core = 'remittance platform';
            } else if (desc.includes('payment gateway') || desc.includes('payment api') || desc.includes('payment infrastructure')) {
                result.core = 'payment infrastructure API';
            } else if (desc.includes('savings') || desc.includes('investment')) {
                result.core = 'digital savings investment app';
            } else {
                result.core = 'fintech startup';
            }
            return result;
        }

        // LOGISTICS / DELIVERY
        if (desc.includes('logistics') || desc.includes('delivery') || desc.includes('shipping') || desc.includes('freight')) {
            result.vertical = 'logistics';
            
            if (desc.includes('last mile')) {
                result.core = 'last mile delivery';
            } else if (desc.includes('freight') || desc.includes('trucking')) {
                result.core = 'freight logistics platform';
            } else if (desc.includes('warehouse')) {
                result.core = 'warehousing logistics';
            } else {
                result.core = 'logistics delivery platform';
            }
            return result;
        }

        // AGRITECH
        if (desc.includes('agri') || desc.includes('farm') || desc.includes('agriculture') || desc.includes('crop')) {
            result.vertical = 'agritech';
            
            if (desc.includes('marketplace')) {
                result.core = 'agricultural marketplace';
            } else if (desc.includes('input') || desc.includes('fertilizer') || desc.includes('seed')) {
                result.core = 'farm inputs platform';
            } else {
                result.core = 'agritech platform';
            }
            return result;
        }

        // HEALTHTECH
        if (desc.includes('health') || desc.includes('medical') || desc.includes('pharmacy') || desc.includes('telemedicine')) {
            result.vertical = 'healthtech';
            
            if (desc.includes('telemedicine') || desc.includes('telehealth')) {
                result.core = 'telemedicine platform';
            } else if (desc.includes('pharmacy')) {
                result.core = 'digital pharmacy';
            } else {
                result.core = 'healthtech platform';
            }
            return result;
        }

        // E-COMMERCE / MARKETPLACE (generic)
        if (desc.includes('marketplace') || desc.includes('e-commerce') || desc.includes('ecommerce')) {
            if (desc.includes('b2b')) {
                result.core = 'B2B marketplace';
            } else {
                result.core = 'e-commerce marketplace';
            }
            result.vertical = 'e-commerce';
            return result;
        }

        // EDTECH
        if (desc.includes('education') || desc.includes('learning') || desc.includes('school') || desc.includes('training')) {
            result.vertical = 'edtech';
            result.core = 'education technology platform';
            return result;
        }

        return result;
    }

    /**
     * Map region codes to meaningful geographic names
     */
    private getRegionName(regions: string[]): string | null {
        const africaCodes = ['NG', 'KE', 'ZA', 'GH', 'EG', 'TZ', 'UG', 'RW', 'ET', 'SN', 'CI'];
        const westAfricaCodes = ['NG', 'GH', 'SN', 'CI', 'BJ', 'TG', 'ML', 'BF'];
        const eastAfricaCodes = ['KE', 'TZ', 'UG', 'RW', 'ET'];
        
        const hasWestAfrica = regions.some(r => westAfricaCodes.includes(r));
        const hasEastAfrica = regions.some(r => eastAfricaCodes.includes(r));
        const hasAfrica = regions.some(r => africaCodes.includes(r));
        
        if (hasWestAfrica && !hasEastAfrica) return 'West Africa';
        if (hasEastAfrica && !hasWestAfrica) return 'East Africa';
        if (hasAfrica) return 'Africa';
        
        return null;
    }

    @UseGuards(AuthGuard)
    @Post('runs')
    createRun(
        @Body() createRunDto: CreateDiscoveryRunDto,
        @Query('organizationId', ParseUUIDPipe) organizationId: string,
        @CurrentUser() user: any,
    ) {
        return this.discoveryService.createRun(
            organizationId,
            user.id,
            createRunDto,
        );
    }

    @UseGuards(AuthGuard)
    @Get('runs/:id')
    getRun(@Param('id') id: string, @CurrentUser() user: any) {
        return this.discoveryService.getRun(id, user.id);
    }

    @UseGuards(AuthGuard)
    @Get('runs')
    listRuns(
        @Query('projectId') projectId: string,
        @CurrentUser() user: any,
    ) {
        return this.discoveryService.listRuns(projectId, user.id);
    }
}
