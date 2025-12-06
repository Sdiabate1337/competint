// Quick test script to debug Supabase query
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

async function testQuery() {
    console.log('Testing Supabase query...');
    console.log('Organization ID: a75d2ad3-6931-4bb3-9d4e-34af1f25a251');
    console.log('Search Run ID: 3aa05324-b387-45a2-ae08-b62564dd4d44');

    try {
        const { data, error } = await supabase
            .from('competitors')
            .select('*')
            .eq('organization_id', 'a75d2ad3-6931-4bb3-9d4e-34af1f25a251')
            .eq('search_run_id', '3aa05324-b387-45a2-ae08-b62564dd4d44')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
            console.log('Success! Found', data?.length || 0, 'competitors');
            console.log('Data:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Caught error:', err);
    }
}

testQuery();
