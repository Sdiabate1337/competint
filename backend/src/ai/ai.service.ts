import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly openai: OpenAI;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not configured - AI features will be disabled');
        }

        this.openai = new OpenAI({
            apiKey: apiKey || 'dummy-key',
        });
    }

    async chat(messages: OpenAI.Chat.ChatCompletionMessageParam[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }) {
        try {
            const response = await this.openai.chat.completions.create({
                model: options?.model || 'gpt-4o-mini',
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
            });

            return {
                content: response.choices[0]?.message?.content || '',
                usage: response.usage,
            };
        } catch (error) {
            this.logger.error(`OpenAI chat error: ${error.message}`);
            throw error;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
            });

            return response.data[0].embedding;
        } catch (error) {
            this.logger.error(`OpenAI embedding error: ${error.message}`);
            throw error;
        }
    }

    async extractStructuredData(content: string, schema: any): Promise<any> {
        const systemPrompt = `You are a competitive intelligence analyst expert at extracting comprehensive company information from web content.

Your task is to extract detailed, accurate information about a company/startup from the provided content.

EXTRACTION GUIDELINES:
1. Extract ONLY factual information explicitly stated or strongly implied in the content
2. For funding amounts, convert to USD numbers (e.g., "$50M" → 50000000, "€10 million" → 10000000)
3. For employee counts, extract the number only (e.g., "51-200 employees" → 100, "~500 staff" → 500)
4. For founding year, extract just the year as a number (e.g., 2019)
5. For country, use ISO 2-letter codes (e.g., "Nigeria" → "NG", "Kenya" → "KE", "United States" → "US")
6. For social links, extract the FULL URL (e.g., "https://twitter.com/companyname")
7. For strengths/weaknesses, provide specific, actionable insights based on the content
8. For investors, list specific names of VCs or individuals mentioned
9. For technologies, list specific tech stack items (languages, frameworks, tools)

IMPORTANT: 
- Be thorough - extract as much information as possible
- If information is not found, use null (not empty strings or arrays)
- Prioritize accuracy over completeness
- For arrays, include at least 2-3 items when information is available

Schema to fill:
${JSON.stringify(schema, null, 2)}

Return ONLY valid JSON, no explanations.`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract company information from this content:\n\n${content}` },
        ];

        const response = await this.chat(messages, { 
            temperature: 0.2, // Lower temperature for more consistent extraction
            maxTokens: 2000, // Ensure enough tokens for comprehensive extraction
        });

        try {
            // Clean up markdown code blocks if present (e.g., ```json ... ```)
            let cleanedContent = response.content.trim();

            // Robust JSON extraction: find the first '{' and the last '}'
            const firstBrace = cleanedContent.indexOf('{');
            const lastBrace = cleanedContent.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanedContent = cleanedContent.substring(firstBrace, lastBrace + 1);
            }

            return JSON.parse(cleanedContent);
        } catch (error) {
            this.logger.error(`Failed to parse AI response as JSON: ${error.message}`);
            this.logger.debug(`Raw response: ${response.content.substring(0, 200)}...`);
            return null;
        }
    }
}
