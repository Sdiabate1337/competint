import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OrgAccessGuard implements CanActivate {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Get organizationId from params, body, or query
        const organizationId =
            request.params.organizationId ||
            request.body?.organizationId ||
            request.query.organizationId;

        if (!organizationId) {
            // If no org ID specified, allow (will be filtered by RLS)
            return true;
        }

        // Check if user is a member of the organization
        const { data: membership, error } = await this.supabaseService
            .getClient()
            .from('organization_members')
            .select('id, role')
            .eq('organization_id', organizationId)
            .eq('user_id', user.id)
            .single();

        if (error || !membership) {
            throw new ForbiddenException('You do not have access to this organization');
        }

        // Attach org membership info to request
        request.organizationMembership = membership;
        return true;
    }
}
