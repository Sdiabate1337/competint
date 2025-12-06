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
        const systemPrompt = `You are an expert at extracting structured information from web content.
Extract the following information from the provided content and return it as valid JSON.
Schema: ${JSON.stringify(schema, null, 2)}

If a field is not found, use null. Be accurate and extract only factual information.`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
        ];

        const response = await this.chat(messages, { temperature: 0.3 });

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
