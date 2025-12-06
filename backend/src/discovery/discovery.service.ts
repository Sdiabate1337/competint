import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDiscoveryRunDto } from './dto/create-discovery-run.dto';

@Injectable()
export class DiscoveryService {
    private readonly logger = new Logger(DiscoveryService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        @InjectQueue('discovery') private discoveryQueue: Queue,
    ) { }

    async createRun(
        organizationId: string,
        userId: string,
        createRunDto: CreateDiscoveryRunDto,
    ) {
        // Verify project belongs to org
        const { data: project } = await this.supabaseService
            .getClient()
            .from('projects')
            .select('id, organization_id')
            .eq('id', createRunDto.projectId)
            .single();

        if (!project || project.organization_id !== organizationId) {
            throw new NotFoundException('Project not found');
        }

        this.logger.log(`Creating discovery run for project: ${createRunDto.projectId}`);

        // Create run record
        const { data: run, error } = await this.supabaseService
            .getClient()
            .from('search_runs')
            .insert({
                project_id: createRunDto.projectId,
                status: 'pending',
                regions: createRunDto.regions,
                keywords: createRunDto.keywords,
                created_by: userId,
            })
            .select()
            .single();

        if (error) {
            this.logger.error('Discovery run creation error:', error);
            throw new Error(`Failed to create run: ${error.message}`);
        }

        this.logger.log(`Discovery run created successfully: ${run.id}`);

        // Add job to queue
        await this.discoveryQueue.add('search', {
            runId: run.id,
            organizationId,
            params: createRunDto,
        });

        this.logger.log(`Added discovery job to queue for run: ${run.id}`);

        return run;
    }

    async getRun(runId: string, userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('search_runs')
            .select('*')
            .eq('id', runId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Run not found');
        }

        return data;
    }

    async listRuns(projectId: string, userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('search_runs')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch runs: ${error.message}`);
        }

        return data || [];
    }
}
