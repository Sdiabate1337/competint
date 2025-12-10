/**
 * Test script for Firecrawl API
 * Run with: npx ts-node scripts/test-firecrawl.ts
 */

import Firecrawl from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.FIRECRAWL_API_KEY;

if (!apiKey) {
    console.error('❌ FIRECRAWL_API_KEY not found in .env');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://firecrawl.dev');
    console.log('2. Create an account');
    console.log('3. Copy your API key (fc-xxx...)');
    console.log('4. Add to .env: FIRECRAWL_API_KEY=fc-xxx...');
    process.exit(1);
}

console.log('✅ Firecrawl API key found');
console.log(`   Key prefix: ${apiKey.substring(0, 8)}...`);

const firecrawl = new Firecrawl({ apiKey });

async function testSearch() {
    console.log('\n🔍 Testing Search API...');
    try {
        const results = await firecrawl.search('fintech startup Nigeria', {
            limit: 3,
            scrapeOptions: {
                formats: ['markdown'],
            },
        }) as any;

        // Response is in results.web
        const webResults = results?.web || [];
        console.log(`   Found ${webResults.length} results`);
        
        if (webResults.length > 0) {
            console.log('\n   First result:');
            console.log(`   - URL: ${webResults[0].url}`);
            console.log(`   - Title: ${webResults[0].title}`);
            console.log(`   - Description: ${webResults[0].description?.substring(0, 100)}...`);
            console.log(`   - Has markdown: ${!!webResults[0].markdown}`);
            if (webResults[0].markdown) {
                console.log(`   - Markdown preview: ${webResults[0].markdown.substring(0, 200)}...`);
            }
        }
        return webResults.length > 0;
    } catch (error: any) {
        console.error(`   ❌ Search failed: ${error.message}`);
        return false;
    }
}

async function testScrape() {
    console.log('\n📄 Testing Scrape API...');
    try {
        const result = await firecrawl.scrape('https://flutterwave.com', {
            formats: ['markdown'],
        });

        console.log(`   ✅ Scraped successfully`);
        console.log(`   - Title: ${result.metadata?.title || 'N/A'}`);
        console.log(`   - Markdown length: ${result.markdown?.length || 0} chars`);
        return true;
    } catch (error: any) {
        console.error(`   ❌ Scrape failed: ${error.message}`);
        return false;
    }
}

async function testExtraction() {
    console.log('\n🧠 Testing JSON Extraction...');
    try {
        const result = await firecrawl.scrape('https://paystack.com', {
            formats: [
                {
                    type: 'json',
                    prompt: 'Extract company name, description, headquarters location, and main products/services',
                },
            ],
        });

        console.log(`   ✅ Extraction successful`);
        console.log(`   - Extracted data:`, JSON.stringify(result.json, null, 2).substring(0, 500));
        return true;
    } catch (error: any) {
        console.error(`   ❌ Extraction failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🔥 Firecrawl API Test\n');
    console.log('='.repeat(50));

    const searchOk = await testSearch();
    const scrapeOk = await testScrape();
    const extractOk = await testExtraction();

    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Results:');
    console.log(`   Search:     ${searchOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Scrape:     ${scrapeOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Extraction: ${extractOk ? '✅ PASS' : '❌ FAIL'}`);

    if (searchOk && scrapeOk && extractOk) {
        console.log('\n🎉 All tests passed! Firecrawl is ready to use.');
    } else {
        console.log('\n⚠️  Some tests failed. Check your API key and quota.');
    }
}

main().catch(console.error);
