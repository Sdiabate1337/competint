-- NUCLEAR OPTION: Disable RLS temporarily to verify the issue
-- This will help us confirm if RLS is the problem
-- ONLY USE THIS FOR DEBUGGING - DO NOT USE IN PRODUCTION

-- Disable RLS on organizations and organization_members temporarily
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_quotas DISABLE ROW LEVEL SECURITY;

-- NOTE: This makes all data publicly accessible!
-- You should re-enable RLS after testing:
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organization_quotas ENABLE ROW LEVEL SECURITY;
