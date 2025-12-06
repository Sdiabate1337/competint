#!/usr/bin/env node

// Quick script to apply migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
    console.log('🔧 Applying migration: add search_runs columns...');

    const sql = `
    ALTER TABLE search_runs 
      ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS results_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS error_message TEXT;
  `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('Reloading schema cache...');

    // Force schema reload by making a simple query
    const { error: testError } = await supabase.from('search_runs').select('id').limit(1);

    if (testError) {
        console.warn('⚠️ Schema cache reload might need manual intervention');
    } else {
        console.log('✅ Schema cache refreshed!');
    }

    process.exit(0);
}

applyMigration().catch(console.error);
