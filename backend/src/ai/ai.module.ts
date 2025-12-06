import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ExtractionService } from './extraction.service';

@Module({
    providers: [AiService, ExtractionService],
    exports: [AiService, ExtractionService],
})
export class AiModule { }
