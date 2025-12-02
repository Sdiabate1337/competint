import { Module } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { CompetitorsController } from './competitors.controller';

@Module({
    controllers: [CompetitorsController],
    providers: [CompetitorsService],
})
export class CompetitorsModule { }
