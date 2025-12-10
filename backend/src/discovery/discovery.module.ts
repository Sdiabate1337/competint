import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryProcessor } from './discovery.processor';
import { ScoringService } from './services/scoring.service';
import { FirecrawlService } from './services/firecrawl.service';
import { SocialMediaService } from './services/social-media.service';
import { EnrichmentService } from './services/enrichment.service';
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
        ScoringService,
        FirecrawlService,      // Main search + scraping provider
        SocialMediaService,
        EnrichmentService,
    ],
    exports: [DiscoveryService, EnrichmentService, FirecrawlService],
})
export class DiscoveryModule { }
