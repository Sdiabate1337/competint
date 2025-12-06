import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryProcessor } from './discovery.processor';
import { TavilyService } from './services/tavily.service';
import { ScoringService } from './services/scoring.service';
import { AiModule } from '../ai/ai.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [
        AiModule,
        SupabaseModule,
        BullModule.registerQueue({
            name: 'discovery',
        }),
    ],
    controllers: [DiscoveryController],
    providers: [
        DiscoveryService,
        DiscoveryProcessor,
        TavilyService,
        ScoringService,
    ],
    exports: [DiscoveryService],
})
export class DiscoveryModule { }
