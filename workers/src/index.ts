import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

interface DiscoveryJobData {
    runId: string;
    country: string;
    keywords: string[];
    promptTemplateId?: string;
    organizationId: string;
}

const discoveryWorker = new Worker<DiscoveryJobData>(
    'discovery',
    async (job: Job<DiscoveryJobData>) => {
        const { runId, country, keywords, promptTemplateId, organizationId } = job.data;

        console.log(`Processing discovery job for ${country}, run ${runId}`);

        try {
            // 1. Update queue status to processing
            await updateQueueStatus(job.id!, 'processing');

            // 2. Call SERP API (mock for now - implement SerpApi later)
            console.log(`Fetching SERP results for ${keywords.join(' ')} in ${country}`);
            // const serpResults = await fetchSerpResults(keywords, country);

            // 3. Extract competitors using LLM (mock for now)
            console.log('Extracting competitors with LLM...');
            // const competitors = await extractCompetitors(serpResults, promptTemplateId);

            // 4. Generate embeddings
            console.log('Generating embeddings...');
            // const competitorsWithEmbeddings = await addEmbeddings(competitors);

            // 5. Deduplicate and insert into database
            console.log('Deduplicating and saving competitors...');
            // await saveCompetitors(competitorsWithEmbeddings, organizationId, runId);

            // 6. Update queue status to completed
            await updateQueueStatus(job.id!, 'completed');

            // 7. Update search run progress
            await updateSearchRunProgress(runId);

            console.log(`Completed discovery job for ${country}`);

            return { success: true, country };
        } catch (error) {
            console.error(`Error processing job for ${country}:`, error);
            await updateQueueStatus(job.id!, 'failed', (error as Error).message);
            throw error;
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: 5, // Process 5 countries in parallel
    }
);

async function updateQueueStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
) {
    const updates: any = {
        status,
        [`${status}_at`]: new Date().toISOString(),
    };

    if (errorMessage) {
        updates.error_message = errorMessage;
    }

    await supabase
        .from('discovery_queue')
        .update(updates)
        .eq('job_id', jobId);
}

async function updateSearchRunProgress(runId: string) {
    // Get all queue items for this run
    const { data: queueItems } = await supabase
        .from('discovery_queue')
        .select('status')
        .eq('search_run_id', runId);

    const allCompleted = queueItems?.every(item =>
        item.status === 'completed' || item.status === 'failed'
    );

    if (allCompleted) {
        const hasFailures = queueItems?.some(item => item.status === 'failed');

        await supabase
            .from('search_runs')
            .update({
                status: hasFailures ? 'completed' : 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', runId);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await discoveryWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await discoveryWorker.close();
    process.exit(0);
});

console.log('🔨 Discovery worker started and waiting for jobs...');

export default discoveryWorker;
