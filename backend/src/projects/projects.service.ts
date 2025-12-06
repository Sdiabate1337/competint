import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(organizationId: string, userId: string, createProjectDto: CreateProjectDto) {
        try {
            // Verify user is a member with appropriate role
            const { data: membership, error: membershipError } = await this.supabaseService
                .getClient()
                .from('organization_members')
                .select('role')
                .eq('organization_id', organizationId)
                .eq('user_id', userId)
                .single();

            if (membershipError || !membership) {
                console.error('Membership check failed:', membershipError);
                throw new ForbiddenException('User is not a member of this organization');
            }

            if (!['owner', 'admin', 'member'].includes(membership.role)) {
                throw new ForbiddenException('Insufficient permissions to create project');
            }

            const { data, error } = await this.supabaseService
                .getClient()
                .from('projects')
                .insert({
                    organization_id: organizationId,
                    created_by: userId,
                    ...createProjectDto,
                })
                .select()
                .single();

            if (error) {
                console.error('Project creation error:', error);
                throw new Error(`Failed to create project: ${error.message}`);
            }

            console.log(`✅ Project created: ${data.name} (${data.id})`);
            return data;
        } catch (err) {
            console.error('Error in create():', err.message);
            throw err;
        }
    }

    async findAll(organizationId: string, userId: string) {
        // RLS will automatically filter by organization membership
        const { data, error } = await this.supabaseService
            .getClient()
            .from('projects')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch projects: ${error.message}`);
        }

        return data || [];
    }

    async findOne(id: string, userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException('Project not found');
        }

        return data;
    }

    async update(id: string, userId: string, updateProjectDto: UpdateProjectDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('projects')
            .update(updateProjectDto)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new NotFoundException('Project not found or you do not have permission to update it');
        }

        return data;
    }

    async remove(id: string, userId: string) {
        const { error } = await this.supabaseService
            .getClient()
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) {
            throw new NotFoundException('Project not found or you do not have permission to delete it');
        }

        return { message: 'Project deleted successfully' };
    }
}
