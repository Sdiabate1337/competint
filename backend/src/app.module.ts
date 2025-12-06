import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { ProjectsModule } from './projects/projects.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    AiModule,
    OrganizationsModule,
    ProjectsModule,
    DiscoveryModule,
    CompetitorsModule,
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
