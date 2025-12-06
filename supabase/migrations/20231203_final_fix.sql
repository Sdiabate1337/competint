-- FINAL FIX: Complete RLS setup for organization creation
-- Run this in Supabase SQL Editor

-- 1. Fix organizations policies
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations where they are members" ON organizations;
DROP POLICY IF EXISTS "Owners can update organizations" ON organizations;

-- Allow authenticated users to create organizations
CREATE POLICY "authenticated_insert_orgs" ON organizations
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Users can view orgs where they're members
CREATE POLICY "select_member_orgs" ON organizations
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- Owners can update their orgs
CREATE POLICY "update_owned_orgs" ON organizations
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- 2. Fix organization_members policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can create memberships" ON organization_members;

-- Users can see their own memberships
CREATE POLICY "select_own_memberships" ON organization_members
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert themselves as members (for org creation)
CREATE POLICY "insert_own_membership" ON organization_members
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins/owners can manage other members
CREATE POLICY "manage_team_members" ON organization_members
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- 3. Fix organization_quotas policies
DROP POLICY IF EXISTS "Users can view their organization's quotas" ON organization_quotas;

-- Allow inserting quotas for new orgs
CREATE POLICY "insert_org_quotas" ON organization_quotas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Users can view quotas for their orgs
CREATE POLICY "select_org_quotas" ON organization_quotas
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
