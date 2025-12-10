import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import { ExtractionService, CompetitorData } from '../ai/extraction.service';
import { FirecrawlService } from './services/firecrawl.service';
import { ScoringService } from './services/scoring.service';
import { CreateDiscoveryRunDto } from './dto/create-discovery-run.dto';

@Processor('discovery')
export class DiscoveryProcessor extends WorkerHost {
    private readonly logger = new Logger(DiscoveryProcessor.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly extractionService: ExtractionService,
        private readonly firecrawlService: FirecrawlService,
        private readonly scoringService: ScoringService,
    ) {
        super();
    }

    async process(job: Job<{ runId: string; organizationId: string; params: CreateDiscoveryRunDto }>) {
        if (job.name === 'search') {
            return this.handleSearch(job);
        }
    }

    private async handleSearch(job: Job<{ runId: string; organizationId: string; params: CreateDiscoveryRunDto }>) {
        const { runId, organizationId, params } = job.data;
        this.logger.log(`[DiscoveryProcessor] Processing job for run: ${runId}`);

        try {
            // Update status to running
            await this.updateRunStatus(runId, 'running');

            // Fetch project details to build intelligent query if no keywords provided
            const { data: project } = await this.supabaseService.getClient()
                .from('projects')
                .select('name, description, keywords, industries, target_regions')
                .eq('id', params.projectId)
                .single();

            // Build search terms: use provided keywords, or build from project description
            let searchTerms = params.keywords && params.keywords.length > 0 
                ? params.keywords 
                : this.buildSearchTermsFromProject(project);

            this.logger.log(`[DiscoveryProcessor] Search terms: ${JSON.stringify(searchTerms)}`);

            const allCompetitors: CompetitorData[] = [];

            for (const region of params.regions) {
                this.logger.log(`Processing region: ${region}`);

                for (const keyword of searchTerms) {
                    // 1. Firecrawl Search
                    const searchResults = await this.firecrawlService.searchWithContext(
                        keyword,
                        {
                            region,
                            industry: params.industries?.[0] || project?.industries?.[0],
                        },
                        {
                            limit: Math.min(params.maxResults || 10, 10),
                        },
                    );

                    this.logger.log(`Firecrawl found ${searchResults.length} results for "${keyword}" in ${region}`);

                    // 2. Extract & Score
                    for (const result of searchResults) {
                        const contentForExtraction = result.markdown || result.description;

                        if (!contentForExtraction || contentForExtraction.length < 100) {
                            continue;
                        }

                        // Extract
                        const extracted = await this.extractionService.extractCompetitorData(
                            contentForExtraction,
                            result.url,
                        );

                        if (!extracted) {
                            continue;
                        }

                        // Score
                        const isRelevant = this.scoringService.isRelevant(extracted, {
                            targetIndustries: params.industries,
                            targetCountry: region,
                            keywords: params.keywords,
                        });

                        if (!isRelevant) {
                            this.logger.debug(`Competitor "${extracted.name}" scored below threshold`);
                            continue;
                        }

                        // Check Duplicate
                        const isDuplicate = await this.checkDuplicate(
                            extracted,
                            organizationId,
                        );

                        if (isDuplicate) {
                            this.logger.debug(`Duplicate detected: ${extracted.name}`);
                            continue;
                        }

                        allCompetitors.push(extracted);
                        await this.saveCompetitor(extracted, runId, organizationId);
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Update status to completed
            await this.updateRunStatus(runId, 'completed', allCompetitors.length);
            this.logger.log(`Discovery completed. Found ${allCompetitors.length} competitors`);
        } catch (error) {
            this.logger.error(`Discovery error: ${error.message}`);
            await this.updateRunStatus(runId, 'failed', 0, error.message);
            throw error; // Mark job as failed
        }
    }

    private async checkDuplicate(
        competitor: CompetitorData,
        organizationId: string,
    ): Promise<boolean> {
        try {
            const embedding = await this.extractionService.generateCompetitorEmbedding(
                competitor,
            );

            const { data: similar } = await this.supabaseService
                .getClient()
                .rpc('match_competitors', {
                    query_embedding: embedding,
                    match_threshold: 0.85,
                    match_count: 1,
                    org_id: organizationId,
                });

            return similar && similar.length > 0;
        } catch (error) {
            this.logger.warn(`Duplicate check failed: ${error.message}`);
            return false;
        }
    }

    private async saveCompetitor(
        competitor: CompetitorData,
        runId: string,
        organizationId: string,
    ) {
        try {
            const embedding = await this.extractionService.generateCompetitorEmbedding(
                competitor,
            );

            // Format funding amount
            const formatFunding = (amount?: number): string | null => {
                if (!amount) return null;
                if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
                if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
                if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
                return `$${amount}`;
            };

            // Format founders array to string
            const formatFounders = (founders?: { name: string; role?: string }[]): string | null => {
                if (!founders || founders.length === 0) return null;
                return founders.map(f => f.role ? `${f.name} (${f.role})` : f.name).join(', ');
            };

            try {
                const dbCompetitor = {
                    organization_id: organizationId,
                    search_run_id: runId,
                    name: competitor.name,
                    website: competitor.website,
                    description: competitor.description,
                    tagline: competitor.tagline,
                    business_model: competitor.business_model,
                    value_proposition: competitor.value_proposition,
                    industry: competitor.industry,
                    country: competitor.country,
                    headquarters: competitor.headquarters,
                    founding_year: competitor.founded_year,
                    founders: formatFounders(competitor.founders),
                    founders_structured: competitor.founders || [],
                    funding: formatFunding(competitor.funding_raised),
                    funding_stage: competitor.funding_stage,
                    investors: competitor.investors,
                    employee_count: competitor.employee_count ? competitor.employee_count.toString() : null,
                    technologies: competitor.technologies,
                    products_services: competitor.products_services,
                    target_market: competitor.target_market,
                    pricing_model: competitor.pricing_model,
                    customers: competitor.customers,
                    partnerships: competitor.partnerships,
                    // SWOT Analysis
                    strengths: competitor.strengths,
                    weaknesses: competitor.weaknesses,
                    key_differentiators: competitor.key_differentiators,
                    growth_signals: competitor.growth_signals,
                    // Social links as JSONB
                    social_links: competitor.social_links || {},
                    embedding,
                    validation_status: 'pending',
                };

                const { error } = await this.supabaseService.getClient().from('competitors').insert(dbCompetitor);

                if (error) throw error;

                this.logger.log(`Successfully saved competitor: ${competitor.name} with ${Object.keys(dbCompetitor).filter(k => dbCompetitor[k]).length} fields`);
            } catch (insertError) {
                this.logger.warn(`Failed to save with all fields, retrying with basic fields: ${insertError.message}`);

                // Fallback: save only basic fields that definitely exist
                const basicCompetitor = {
                    organization_id: organizationId,
                    search_run_id: runId,
                    name: competitor.name,
                    website: competitor.website,
                    description: competitor.description,
                    business_model: competitor.business_model,
                    value_proposition: competitor.value_proposition,
                    industry: competitor.industry,
                    country: competitor.country,
                    founding_year: competitor.founded_year,
                    founders: formatFounders(competitor.founders),
                    funding: formatFunding(competitor.funding_raised),
                    employee_count: competitor.employee_count ? competitor.employee_count.toString() : null,
                    validation_status: 'pending',
                };

                const { error: fallbackError } = await this.supabaseService.getClient()
                    .from('competitors')
                    .insert(basicCompetitor);

                if (fallbackError) {
                    this.logger.error(`Fallback save failed for ${competitor.name}: ${fallbackError.message}`);
                } else {
                    this.logger.log(`Saved competitor ${competitor.name} with basic fields`);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to save competitor: ${error.message}`);
        }
    }

    private async updateRunStatus(
        runId: string,
        status: 'pending' | 'running' | 'completed' | 'failed',
        resultsCount?: number,
        errorMessage?: string,
    ) {
        const updates: any = { status };

        if (resultsCount !== undefined) {
            updates.results_count = resultsCount;
        }

        if (status === 'completed' || status === 'failed') {
            updates.completed_at = new Date().toISOString();
        }

        if (errorMessage) {
            updates.error_message = errorMessage;
        }

        await this.supabaseService
            .getClient()
            .from('search_runs')
            .update(updates)
            .eq('id', runId);
    }

    /**
     * Build intelligent search terms from project data
     */
    private buildSearchTermsFromProject(project: any): string[] {
        if (!project) {
            return ['startup company'];
        }

        const terms: string[] = [];
        const desc = (project.description || '').toLowerCase();

        // Detect business model from description
        let businessModel = '';

        // NEOBANK / CHALLENGER BANK
        if (desc.includes('challenger bank') || desc.includes('neobank') || desc.includes('digital bank') ||
            (desc.includes('digital account') && desc.includes('savings')) ||
            (desc.includes('mobile-first') && desc.includes('financial'))) {
            businessModel = 'neobank challenger bank mobile banking';
            if (desc.includes('africa')) businessModel += ' Africa';
        }
        // CONSTRUCTION / BUILDING MATERIALS
        else if (desc.includes('construction') || desc.includes('building material') || desc.includes('hardware')) {
            businessModel = 'construction materials marketplace';
            if (desc.includes('b2b')) businessModel += ' B2B';
        }
        // FINTECH / PAYMENTS
        else if (desc.includes('fintech') || desc.includes('payment') || desc.includes('mobile money')) {
            if (desc.includes('lending') || desc.includes('credit')) {
                businessModel = 'digital lending platform';
            } else if (desc.includes('mobile money')) {
                businessModel = 'mobile money wallet';
            } else {
                businessModel = 'fintech payment platform';
            }
        }
        // LOGISTICS
        else if (desc.includes('logistics') || desc.includes('delivery')) {
            businessModel = 'logistics delivery platform';
        }
        // AGRITECH
        else if (desc.includes('agri') || desc.includes('farm')) {
            businessModel = 'agritech platform';
        }
        // E-COMMERCE
        else if (desc.includes('marketplace') || desc.includes('e-commerce')) {
            businessModel = desc.includes('b2b') ? 'B2B marketplace' : 'e-commerce marketplace';
        }

        // Add business model as primary search term
        if (businessModel) {
            terms.push(businessModel);
        }

        // Add industries
        if (project.industries && project.industries.length > 0) {
            terms.push(project.industries.join(' '));
        }

        // Add project name as fallback
        if (terms.length === 0 && project.name) {
            terms.push(`${project.name} competitors`);
        }

        // Add geographic context
        if (desc.includes('africa')) {
            terms.push('Africa startup');
        }

        // Ensure we have at least one term
        if (terms.length === 0) {
            terms.push('startup company');
        }

        this.logger.log(`[buildSearchTermsFromProject] Generated terms: ${JSON.stringify(terms)}`);
        return terms;
    }
}
