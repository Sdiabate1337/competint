/**
 * Test script for full enrichment pipeline
 * Run with: npx ts-node scripts/test-enrichment.ts
 */

import Firecrawl from '@mendable/firecrawl-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Zod schema for company extraction
const CompanySchema = z.object({
    company_name: z.string(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    founding_year: z.number().optional(),
    headquarters: z.string().optional(),
    employee_count: z.string().optional(),
    business_model: z.string().optional(),
    products_services: z.array(z.string()).optional(),
    funding_stage: z.string().optional(),
    total_funding: z.string().optional(),
    investors: z.array(z.string()).optional(),
    technologies: z.array(z.string()).optional(),
});

async function testFullPipeline() {
    console.log('🚀 Testing Full Enrichment Pipeline\n');
    console.log('='.repeat(60));

    // Step 1: Search for competitors
    console.log('\n📍 Step 1: Search for competitors...');
    const searchResults = await firecrawl.search('mobile payment fintech Kenya', {
        limit: 2,
        scrapeOptions: { formats: ['markdown'] },
    }) as any;

    const competitors = searchResults?.web || [];
    console.log(`   Found ${competitors.length} potential competitors`);

    if (competitors.length === 0) {
        console.log('❌ No competitors found');
        return;
    }

    // Step 2: Deep scrape first competitor
    const targetUrl = competitors[0].url;
    console.log(`\n📍 Step 2: Deep scrape ${targetUrl}...`);
    
    const scrapedData = await firecrawl.scrape(targetUrl, {
        formats: [
            'markdown',
            {
                type: 'json',
                prompt: `Extract company information: company_name, tagline, description, founding_year, headquarters, employee_count, business_model, products_services (array), funding_stage, total_funding, investors (array), technologies (array)`,
            },
        ],
    });

    console.log('   ✅ Scraped successfully');
    console.log(`   - Markdown: ${scrapedData.markdown?.length || 0} chars`);
    console.log(`   - Extracted JSON:`, JSON.stringify(scrapedData.json, null, 2));

    // Step 3: AI Analysis
    console.log('\n📍 Step 3: AI Competitive Analysis...');
    
    const analysisPrompt = `
Analyze this competitor and provide:
1. SWOT analysis (brief)
2. Market positioning
3. Growth signals
4. Risk factors

Company data:
${JSON.stringify(scrapedData.json, null, 2)}

Content preview:
${scrapedData.markdown?.substring(0, 2000)}
`;

    const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a competitive intelligence analyst. Provide concise, actionable insights.' },
            { role: 'user', content: analysisPrompt },
        ],
        max_tokens: 500,
    });

    console.log('   ✅ AI Analysis complete');
    console.log('\n' + '─'.repeat(60));
    console.log('📊 COMPETITIVE ANALYSIS:');
    console.log('─'.repeat(60));
    console.log(aiResponse.choices[0].message.content);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Pipeline Test Complete!');
    console.log('='.repeat(60));
    console.log('\nEnriched Competitor:');
    console.log(`  Name: ${(scrapedData.json as any)?.company_name || 'Unknown'}`);
    console.log(`  URL: ${targetUrl}`);
    console.log(`  Data completeness: ${Object.keys(scrapedData.json || {}).length} fields`);
}

testFullPipeline().catch(console.error);
