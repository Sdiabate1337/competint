/**
 * Discovery Service
 * 
 * Orchestrates the discovery process:
 * 1. Creates discovery run record
 * 2. Queues the discovery job
 * 3. Provides status updates
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { DiscoveryContext } from './types';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectQueue('discovery') private readonly discoveryQueue: Queue,
  ) {}

  /**
   * Start a new discovery run
   */
  async createRun(
    organizationId: string,
    userId: string,
    dto: CreateDiscoveryDto,
  ) {
    // Verify project belongs to organization
    const { data: project, error: projectError } = await this.supabaseService
      .getClient()
      .from('projects')
      .select('id, name, organization_id')
      .eq('id', dto.projectId)
      .single();

    if (projectError || !project) {
      throw new NotFoundException('Project not found');
    }

    if (project.organization_id !== organizationId) {
      throw new NotFoundException('Project not found in this organization');
    }

    this.logger.log(`Creating discovery run for project: ${project.name}`);

    // Create run record
    const { data: run, error: runError } = await this.supabaseService
      .getClient()
      .from('search_runs')
      .insert({
        project_id: dto.projectId,
        status: 'pending',
        regions: dto.regions,
        keywords: dto.keywords,
        created_by: userId,
        results_count: 0,
      })
      .select()
      .single();

    if (runError) {
      this.logger.error(`Failed to create run: ${runError.message}`);
      throw new Error('Failed to create discovery run');
    }

    this.logger.log(`Discovery run created: ${run.id}`);

    // Check if user is premium (simplified - you can enhance this)
    const isPremium = await this.checkPremiumStatus(organizationId);

    // Build context for the processor
    const context: DiscoveryContext = {
      runId: run.id,
      projectId: dto.projectId,
      organizationId,
      userId,
      keywords: dto.keywords,
      regions: dto.regions,
      industries: dto.industries,
      maxResults: dto.maxResults || 10,
      isPremium,
    };

    // Queue the discovery job
    await this.discoveryQueue.add('discover', context, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    this.logger.log(`Discovery job queued for run: ${run.id}`);

    return run;
  }

  /**
   * Get discovery run by ID
   */
  async getRun(runId: string, organizationId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('search_runs')
      .select(`
        *,
        project:projects(name, organization_id)
      `)
      .eq('id', runId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Discovery run not found');
    }

    // Verify organization access
    if (data.project?.organization_id !== organizationId) {
      throw new NotFoundException('Discovery run not found');
    }

    return data;
  }

  /**
   * List discovery runs for a project
   */
  async listRuns(projectId: string, organizationId: string) {
    // Verify project access
    const { data: project } = await this.supabaseService
      .getClient()
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();

    if (!project || project.organization_id !== organizationId) {
      throw new NotFoundException('Project not found');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('search_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error('Failed to fetch discovery runs');
    }

    return data || [];
  }

  /**
   * Check if organization has premium status
   */
  private async checkPremiumStatus(organizationId: string): Promise<boolean> {
    const { data } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select('subscription_tier')
      .eq('id', organizationId)
      .single();

    return data?.subscription_tier === 'premium' || data?.subscription_tier === 'trial';
  }
}
