import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EnrichmentService } from '../discovery/services/enrichment.service';

@Controller('competitors')
@UseGuards(AuthGuard)
export class CompetitorsController {
    constructor(
        private readonly competitorsService: CompetitorsService,
        private readonly enrichmentService: EnrichmentService,
    ) { }

    @Get()
    async findAll(@Query() filters: any, @CurrentUser() user: any) {
        console.log('=== COMPETITORS FINDALL ===');
        console.log('Filters:', JSON.stringify(filters, null, 2));
        console.log('User:', user?.id);

        // Get user's organization from membership
        // For now, we'll pass organizationId as query param from frontend
        const organizationId = filters.organizationId;

        console.log('Organization ID:', organizationId);

        try {
            const result = await this.competitorsService.findAll(organizationId, filters);
            console.log('Result count:', result?.length || 0);
            return result;
        } catch (error) {
            console.error('ERROR in findAll controller:', error);
            throw error;
        }
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @CurrentUser() user: any) {
        // Use findById which doesn't require organization filtering
        const competitor = await this.competitorsService.findById(id);
        if (!competitor) {
            throw new Error('Competitor not found');
        }
        return competitor;
    }

    @Patch(':id/validate')
    async validateCompetitor(
        @Param('id') id: string,
        @Body() body: { status: 'approved' | 'rejected' },
        @CurrentUser() user: any,
    ) {
        console.log(`=== VALIDATE COMPETITOR ${id} ===`);
        console.log('Status:', body.status);
        console.log('User:', JSON.stringify(user));

        try {
            // Get the competitor first to find its organization_id
            const competitor = await this.competitorsService.findById(id);
            if (!competitor) {
                throw new Error('Competitor not found');
            }

            return await this.competitorsService.updateValidationStatus(
                id,
                competitor.organization_id,
                body.status,
                user?.id,
            );
        } catch (error) {
            console.error('Validation Error:', error);
            throw error;
        }
    }

    @Get(':id/similar')
    async findSimilar(
        @Param('id') id: string,
        @Query('limit') limit?: number,
        @CurrentUser() user?: any,
    ) {
        const organizationId = 'demo-org-id';
        return this.competitorsService.searchSimilar(
            id,
            organizationId,
            limit ? parseInt(limit.toString()) : 10,
        );
    }

    @Post(':id/enrich')
    async enrichCompetitor(
        @Param('id') id: string,
        @CurrentUser() user: any,
    ) {
        console.log(`=== ENRICH COMPETITOR ${id} ===`);

        try {
            // Get the competitor
            console.log('Step 1: Finding competitor...');
            const competitor = await this.competitorsService.findById(id);
            if (!competitor) {
                throw new Error('Competitor not found');
            }
            console.log('Found competitor:', competitor.name);

            if (!competitor.website) {
                throw new Error('Competitor has no website to enrich from');
            }

            console.log(`Step 2: Enriching ${competitor.name} from ${competitor.website}`);

            // Run full enrichment with AI analysis
            const enrichedData = await this.enrichmentService.enrichCompetitor(
                competitor.website,
                {
                    name: competitor.name,
                    description: competitor.description,
                    business_model: competitor.business_model,
                    industry: competitor.industry,
                    country: competitor.country,
                    total_funding: competitor.funding,
                },
                {
                    includeSocialMedia: true,
                    includeAiAnalysis: true, // Enable AI for SWOT analysis
                    crawlDepth: 2, // Crawl more pages for better context
                }
            );

            console.log('Step 3: Enrichment complete');
            console.log('Enriched data keys:', Object.keys(enrichedData));

            // Update competitor with enriched data
            console.log('Step 4: Updating competitor in database...');
            const updatedCompetitor = await this.competitorsService.updateWithEnrichment(
                id,
                enrichedData,
            );

            console.log('Step 5: Update complete');
            return updatedCompetitor;
        } catch (error) {
            console.error('Enrichment Error:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }
}
