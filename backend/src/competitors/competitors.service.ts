import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CompetitorsService {
    constructor(private supabaseService: SupabaseService) { }

    async findAll(organizationId: string, filters?: any) {
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

        const { data, error } = await query.order('created_at', { ascending: false });

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
    ) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('competitors')
            .update({ validation_status: status })
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
}
