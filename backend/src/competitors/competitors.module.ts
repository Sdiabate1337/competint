import { Module } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { CompetitorsController } from './competitors.controller';
import { DiscoveryModule } from '../discovery/discovery.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [DiscoveryModule, SupabaseModule],
    controllers: [CompetitorsController],
    providers: [CompetitorsService],
})
export class CompetitorsModule { }
