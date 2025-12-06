import { Injectable, Logger } from '@nestjs/common';
import { CompetitorData } from '../../ai/extraction.service';

export interface ScoringContext {
    targetIndustries?: string[];
    targetCountry?: string;
    keywords?: string[];
}

const MINIMUM_SCORE_THRESHOLD = 75; // 75% as requested

@Injectable()
export class ScoringService {
    private readonly logger = new Logger(ScoringService.name);

    calculateRelevanceScore(
        competitor: CompetitorData,
        context: ScoringContext,
    ): number {
        let score = 0;

        // 1. Industry Match (30 points)
        if (context.targetIndustries?.length && competitor.industry) {
            const industryMatch = context.targetIndustries.some(
                target => competitor.industry?.toLowerCase().includes(target.toLowerCase())
            );
            if (industryMatch) {
                score += 30;
            }
        }

        // 2. Geographic Relevance (25 points)
        if (context.targetCountry && competitor.country) {
            if (competitor.country.toUpperCase() === context.targetCountry.toUpperCase()) {
                score += 25;
            }
        }

        // 3. Data Completeness (20 points)
        const fields = [
            competitor.name,
            competitor.description,
            competitor.website,
            competitor.business_model,
            competitor.value_proposition,
        ];
        const completeness = fields.filter(Boolean).length / fields.length;
        score += Math.round(completeness * 20);

        // 4. Recency / Founded Year (15 points)
        if (competitor.founded_year) {
            const currentYear = new Date().getFullYear();
            const age = currentYear - competitor.founded_year;

            if (age <= 3) score += 15; // Very recent
            else if (age <= 5) score += 10; // Recent
            else if (age <= 10) score += 5; // Somewhat recent
        }

        // 5. Funding Signal (10 points)
        if (competitor.funding_raised) {
            if (competitor.funding_raised >= 1000000) score += 10; // $1M+
            else if (competitor.funding_raised >= 100000) score += 5; // $100K+
        }

        this.logger.debug(`Score for ${competitor.name}: ${score}/100`);
        return score;
    }

    isRelevant(competitor: CompetitorData, context: ScoringContext): boolean {
        const score = this.calculateRelevanceScore(competitor, context);
        return score >= MINIMUM_SCORE_THRESHOLD;
    }
}
