import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { CompetitorsModule } from './competitors/competitors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    OrganizationsModule,
    DiscoveryModule,
    CompetitorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
