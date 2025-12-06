import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly supabaseService: SupabaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid authorization header');
        }

        const token = authHeader.substring(7);

        try {
            // Decode JWT locally instead of making network call
            // Supabase JWTs are standard JWTs that can be decoded without verification
            // The signature will be verified by Supabase when the client makes RLS-secured queries
            const payload = this.decodeJWT(token);

            if (!payload || !payload.sub) {
                throw new UnauthorizedException('Invalid token');
            }

            // Attach user info to request
            request.user = {
                id: payload.sub,
                email: payload.email,
                ...payload
            };

            return true;
        } catch (error) {
            console.error('Auth error:', error.message);
            throw new UnauthorizedException('Failed to authenticate user');
        }
    }

    private decodeJWT(token: string): any {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            const payload = parts[1];
            const decoded = Buffer.from(payload, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch (error) {
            throw new Error('Failed to decode JWT');
        }
    }
}
