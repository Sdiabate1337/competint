import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const upstashUrl = configService.get('UPSTASH_REDIS_REST_URL');
        
        // If Upstash REST URL is provided, extract host for native connection
        if (upstashUrl) {
          // Upstash native Redis endpoint: replace REST URL format
          // REST: https://xxx.upstash.io -> Native: xxx.upstash.io:6379
          const host = upstashUrl.replace('https://', '').replace('http://', '');
          return {
            connection: {
              host,
              port: 6379,
              password: configService.get('UPSTASH_REDIS_REST_TOKEN'),
              tls: {},
            },
          };
        }
        
        // Fallback to standard Redis config
        return {
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
          },
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
