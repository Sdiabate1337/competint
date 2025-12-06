-- SIMPLE FIX: Remove all complex RLS and use basic policies
-- This avoids the infinite recursion issue by using simple, direct checks

-- 1. Drop existing problematic policies on organization_members
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON organization_members;

-- 2. Create simple, non-recursive policies for organization_members
-- Users can always see their own memberships
CREATE POLICY "Users can view their own memberships" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert themselves as members (during org creation)
CREATE POLICY "Users can create memberships" ON organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Drop existing problematic policies on organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organization" ON organizations;

-- 4. Create simple policies for organizations
-- Allow users to view organizations (we'll filter by membership in the client)
-- This is temporary - we check membership via organization_members
CREATE POLICY "Users can view organizations where they are members" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- Allow authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update their organization
CREATE POLICY "Owners can update organizations" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );
