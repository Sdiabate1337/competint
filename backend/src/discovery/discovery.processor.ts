import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import { ExtractionService, CompetitorData } from '../ai/extraction.service';
import { TavilyService } from './services/tavily.service';
import { ScoringService } from './services/scoring.service';
import { CreateDiscoveryRunDto } from './dto/create-discovery-run.dto';

@Processor('discovery')
export class DiscoveryProcessor extends WorkerHost {
    private readonly logger = new Logger(DiscoveryProcessor.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly extractionService: ExtractionService,
        private readonly tavilyService: TavilyService,
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

            const allCompetitors: CompetitorData[] = [];

            for (const region of params.regions) {
                this.logger.log(`Processing region: ${region}`);

                for (const keyword of params.keywords) {
                    // 1. Tavily Search
                    const tavilyResults = await this.tavilyService.searchWithContext(
                        keyword,
                        {
                            region,
                            industry: params.industries?.[0],
                        },
                        {
                            maxResults: Math.min(params.maxResults || 10, 10),
                        },
                    );

                    this.logger.log(`Tavily found ${tavilyResults.length} results for "${keyword}" in ${region}`);

                    // 2. Extract & Score
                    for (const result of tavilyResults) {
                        const contentForExtraction = result.raw_content || result.content;

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

            try {
                const dbCompetitor = {
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
                    founders: competitor.founders ? competitor.founders.join(', ') : null,
                    funding: competitor.funding_raised ? `$${competitor.funding_raised}` : null,
                    employee_count: competitor.employee_count ? competitor.employee_count.toString() : null,
                    technologies: competitor.technologies,
                    embedding,
                    validation_status: 'pending',
                };

                const { error } = await this.supabaseService.getClient().from('competitors').insert(dbCompetitor);

                if (error) throw error;

                this.logger.log(`Successfully saved competitor: ${competitor.name}`);
            } catch (insertError) {
                this.logger.warn(`Failed to save with embedding, retrying without: ${insertError.message}`);

                const { error: fallbackError } = await this.supabaseService.getClient().from('competitors').insert({
                    organization_id: organizationId,
                    search_run_id: runId,
                    ...competitor,
                    founding_year: competitor.founded_year, // Ensure mapping is correct in fallback too
                    founders: competitor.founders ? competitor.founders.join(', ') : null,
                    funding: competitor.funding_raised ? `$${competitor.funding_raised}` : null,
                    employee_count: competitor.employee_count ? competitor.employee_count.toString() : null,
                    validation_status: 'pending',
                });

                if (fallbackError) {
                    this.logger.error(`Fallback save failed for ${competitor.name}: ${fallbackError.message}`);
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
}
