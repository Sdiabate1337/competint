import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CompetitorsService {
    constructor(private supabaseService: SupabaseService) { }

    async findAll(organizationId: string, filters?: any) {
        try {
            const supabase = this.supabaseService.getClient();

            let query = supabase
                .from('competitors')
                .select('*')
                .eq('organization_id', organizationId);

            // Apply filters if provided
            if (filters?.region) {
                query = query.eq('region', filters.region);
            }
            if (filters?.country) {
                query = query.eq('country', filters.country);
            }
            if (filters?.industry) {
                query = query.eq('industry', filters.industry);
            }
            if (filters?.validation_status) {
                query = query.eq('validation_status', filters.validation_status);
            }
            if (filters?.searchRunId) {
                query = query.eq('search_run_id', filters.searchRunId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error in findAll:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('Error in CompetitorsService.findAll:', error);
            throw error;
        }
    }

    async findById(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('competitors')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async findOne(id: string, organizationId: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('competitors')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data;
    }

    async updateValidationStatus(
        id: string,
        organizationId: string,
        status: 'approved' | 'rejected',
        validatedBy?: string,
    ) {
        const supabase = this.supabaseService.getClient();

        const updates: any = {
            validation_status: status,
            validated_at: new Date().toISOString(),
        };

        if (validatedBy) {
            updates.validated_by = validatedBy;
        }

        const { data, error } = await supabase
            .from('competitors')
            .update(updates)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async searchSimilar(competitorId: string, organizationId: string, limit = 10) {
        const supabase = this.supabaseService.getClient();

        // First get the competitor's embedding
        const { data: competitor, error: competitorError } = await supabase
            .from('competitors')
            .select('embedding')
            .eq('id', competitorId)
            .eq('organization_id', organizationId)
            .single();

        if (competitorError) throw competitorError;

        // Use pgvector similarity search
        // Note: This requires a custom RPC function in Supabase
        const { data, error } = await supabase.rpc('match_competitors', {
            query_embedding: competitor.embedding,
            match_threshold: 0.8,
            match_count: limit,
            org_id: organizationId,
        });

        if (error) throw error;
        return data;
    }

    async updateWithEnrichment(id: string, enrichedData: any) {
        const supabase = this.supabaseService.getClient();

        // Map enriched data to database columns
        const updates: any = {};

        // Basic info
        if (enrichedData.description) updates.description = enrichedData.description;
        if (enrichedData.tagline) updates.tagline = enrichedData.tagline;
        if (enrichedData.value_proposition) updates.value_proposition = enrichedData.value_proposition;
        if (enrichedData.founding_year) updates.founding_year = enrichedData.founding_year;
        if (enrichedData.employee_count) updates.employee_count = String(enrichedData.employee_count);
        if (enrichedData.business_model) updates.business_model = enrichedData.business_model;
        if (enrichedData.headquarters) updates.headquarters = enrichedData.headquarters;

        // Funding
        if (enrichedData.total_funding) updates.funding = enrichedData.total_funding;
        if (enrichedData.funding_stage) updates.funding_stage = enrichedData.funding_stage;
        if (enrichedData.investors) updates.investors = enrichedData.investors;

        // Products & Market
        if (enrichedData.technologies) updates.technologies = enrichedData.technologies;
        if (enrichedData.products_services) updates.products_services = enrichedData.products_services;
        if (enrichedData.target_market) updates.target_market = enrichedData.target_market;
        if (enrichedData.pricing_model) updates.pricing_model = enrichedData.pricing_model;
        if (enrichedData.customers) updates.customers = enrichedData.customers;
        if (enrichedData.partnerships) updates.partnerships = enrichedData.partnerships;

        // SWOT Analysis from competitive_analysis
        if (enrichedData.competitive_analysis) {
            if (enrichedData.competitive_analysis.strengths) {
                updates.strengths = enrichedData.competitive_analysis.strengths;
            }
            if (enrichedData.competitive_analysis.weaknesses) {
                updates.weaknesses = enrichedData.competitive_analysis.weaknesses;
            }
        }

        // Growth signals and risk factors
        if (enrichedData.growth_signals) updates.growth_signals = enrichedData.growth_signals;
        if (enrichedData.risk_factors) updates.risk_factors = enrichedData.risk_factors;
        if (enrichedData.market_positioning) updates.market_positioning = enrichedData.market_positioning;

        // Social links
        if (enrichedData.social_links && Object.keys(enrichedData.social_links).length > 0) {
            updates.social_links = enrichedData.social_links;
        }

        // Enrichment metadata
        updates.enrichment_date = new Date().toISOString();
        if (enrichedData.confidence_score) updates.confidence_score = enrichedData.confidence_score;
        if (enrichedData.data_completeness) updates.data_completeness = enrichedData.data_completeness;
        if (enrichedData.data_sources) updates.data_sources = enrichedData.data_sources;

        console.log('Updating competitor with:', JSON.stringify(updates, null, 2));

        // Only update if we have something to update
        if (Object.keys(updates).length === 0) {
            console.log('No updates to apply, returning current competitor');
            return await this.findById(id);
        }

        const { data, error } = await supabase
            .from('competitors')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating competitor:', error);
            throw error;
        }
        
        return data;
    }
}
