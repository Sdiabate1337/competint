import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OrganizationsService {
    constructor(private supabaseService: SupabaseService) { }

    async findAll(userId: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('organizations')
            .select(`
        *,
        organization_members!inner(role)
      `)
            .eq('organization_members.user_id', userId);

        if (error) throw error;
        return data;
    }

    async findOne(id: string, userId: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('organizations')
            .select(`
        *,
        organization_members!inner(role)
      `)
            .eq('id', id)
            .eq('organization_members.user_id', userId)
            .single();

        if (error) throw error;
        return data;
    }

    async create(name: string, slug: string, userId: string) {
        const supabase = this.supabaseService.getClient();

        // Create organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({ name, slug })
            .select()
            .single();

        if (orgError) throw orgError;

        // Add user as owner
        const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
                organization_id: org.id,
                user_id: userId,
                role: 'owner',
            });

        if (memberError) throw memberError;

        return org;
    }
}
