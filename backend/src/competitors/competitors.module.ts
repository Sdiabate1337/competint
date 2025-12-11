import { Module } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { CompetitorsController } from './competitors.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [CompetitorsController],
    providers: [CompetitorsService],
})
export class CompetitorsModule { }
