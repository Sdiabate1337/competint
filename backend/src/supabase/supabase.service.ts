import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        this.supabase = createClient(
            this.configService.get<string>('SUPABASE_URL')!,
            this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            },
        );
    }

    getClient(): SupabaseClient {
        return this.supabase;
    }

    // Helper method to get authenticated client for a specific user
    getAuthenticatedClient(accessToken: string): SupabaseClient {
        return createClient(
            this.configService.get<string>('SUPABASE_URL')!,
            this.configService.get<string>('SUPABASE_ANON_KEY')!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            },
        );
    }
}
