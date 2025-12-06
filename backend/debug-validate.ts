import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugValidate() {
    const competitorId = '5e50b365-093e-4d02-8ce6-fb8c0fe64300'; // ID from user error
    const organizationId = 'a75d2ad3-6931-4bb3-9d4e-34af1f25a251';
    const userId = '543a8656-6af9-439e-9f62-4842acdfa303'; // User ID from previous logs

    console.log('=== DEBUGGING VALIDATION ===');
    console.log(`Updating competitor ${competitorId} for org ${organizationId}`);

    const updates = {
        validation_status: 'approved',
        validated_at: new Date().toISOString(),
        validated_by: userId
    };

    console.log('Updates:', updates);

    const { data, error } = await supabase
        .from('competitors')
        .update(updates)
        .eq('id', competitorId)
        .eq('organization_id', organizationId)
        .select();

    if (error) {
        console.error('❌ UPDATE FAILED:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ UPDATE SUCCESS!');
        console.log('Updated data:', data);
    }
}

debugValidate().then(() => process.exit(0));
