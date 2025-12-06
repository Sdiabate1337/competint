import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

export interface CompetitorData {
    name: string;
    website?: string;
    description?: string;
    business_model?: string;
    value_proposition?: string;
    industry?: string;
    country?: string;
    founded_year?: number;
    founders?: string[];
    funding_raised?: number;
    employee_count?: number;
    technologies?: string[];
}

@Injectable()
export class ExtractionService {
    private readonly logger = new Logger(ExtractionService.name);

    constructor(private readonly aiService: AiService) { }

    async extractCompetitorData(content: string, sourceUrl?: string): Promise<CompetitorData | null> {
        const schema = {
            name: 'string (required)',
            website: 'string (URL, optional)',
            description: 'string (brief description, 1-2 sentences)',
            business_model: 'string (e.g., SaaS, Marketplace, E-commerce)',
            value_proposition: 'string (what problem they solve)',
            industry: 'string (e.g., Fintech, E-commerce, Healthcare)',
            country: 'string (ISO country code, e.g., US, NG, BR)',
            founded_year: 'number (year founded, optional)',
            founders: 'array of strings (founder names, optional)',
            funding_raised: 'number (in USD, optional)',
            employee_count: 'number (approximate, optional)',
            technologies: 'array of strings (tech stack, optional)',
        };

        try {
            this.logger.log(`Extracting competitor data from content (${content.length} chars)`);

            const extracted = await this.aiService.extractStructuredData(content, schema);

            if (!extracted || !extracted.name) {
                this.logger.warn('Failed to extract valid competitor data');
                return null;
            }

            // Add source URL if provided and not already present
            if (sourceUrl && !extracted.website) {
                extracted.website = sourceUrl;
            }

            return extracted;
        } catch (error) {
            this.logger.error(`Extraction error: ${error.message}`);
            return null;
        }
    }

    async generateCompetitorEmbedding(competitor: CompetitorData): Promise<number[]> {
        // Combine relevant fields for embedding
        const textForEmbedding = [
            competitor.name,
            competitor.description,
            competitor.value_proposition,
            competitor.business_model,
            competitor.industry,
        ]
            .filter(Boolean)
            .join(' | ');

        try {
            return await this.aiService.generateEmbedding(textForEmbedding);
        } catch (error) {
            this.logger.error(`Failed to generate embedding: ${error.message}`);
            throw error;
        }
    }
}
