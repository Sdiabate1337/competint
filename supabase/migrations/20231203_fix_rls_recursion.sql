-- Fix RLS recursion for organization_members

-- Helper function to get user's organizations (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (organization_id UUID) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
STABLE
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid();
$$;

-- Update organization_members policies
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

CREATE POLICY "Users can view members of their organizations" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
  );

-- Update organizations policies (to use the efficient function)
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM get_user_organizations()
    )
  );

-- Update projects policies
DROP POLICY IF EXISTS "Users can view their organization's projects" ON projects;

CREATE POLICY "Users can view their organization's projects" ON projects
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
  );
