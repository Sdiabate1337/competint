/**
 * Discovery Module
 * 
 * Handles competitor discovery with a clean architecture:
 * - Providers: Data sources (Firecrawl, AI fallback)
 * - Extractors: AI-powered data extraction
 * - Processors: Background job workers
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Core
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

// Providers
import { FirecrawlProvider } from './providers/firecrawl.provider';
import { AiFallbackProvider } from './providers/ai-fallback.provider';

// Extractors
import { BasicExtractor } from './extractors/basic.extractor';

// Processors
import { DiscoveryProcessor } from './processors/discovery.processor';

// Dependencies
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
    // Service
    DiscoveryService,
    
    // Providers
    FirecrawlProvider,
    AiFallbackProvider,
    
    // Extractors
    BasicExtractor,
    
    // Processors
    DiscoveryProcessor,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
