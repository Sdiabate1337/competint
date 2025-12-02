import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface StartDiscoveryDto {
    project_id: string;
    regions: string[];
    keywords: string[];
    prompt_template_id?: string;
}

@Injectable()
export class DiscoveryService {
    constructor(private supabaseService: SupabaseService) { }

    async startDiscovery(dto: StartDiscoveryDto, organizationId: string) {
        const supabase = this.supabaseService.getClient();

        // Create search run
        const { data: run, error } = await supabase
            .from('search_runs')
            .insert({
                project_id: dto.project_id,
                regions: dto.regions,
                keywords: dto.keywords,
                prompt_template_id: dto.prompt_template_id,
                status: 'pending',
            })
            .select()
            .single();

        if (error) throw error;

        // TODO: Enqueue jobs to BullMQ for each region
        // For now, just return the run

        return run;
    }

    async getRunStatus(runId: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('search_runs')
            .select('*')
            .eq('id', runId)
            .single();

        if (error) throw error;
        return data;
    }

    async listRuns(projectId: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('search_runs')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}
