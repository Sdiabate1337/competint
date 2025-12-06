-- MASTER FIX: RLS Recursion & Invitations
-- Run this entire script in Supabase SQL Editor to fix 500/403 errors and missing tables.

-- 1. Fix RLS Infinite Recursion
-- We use a SECURITY DEFINER function to break the loop when checking organization membership.

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
DROP POLICY IF EXISTS "Owners and admins can manage members" ON organization_members;

CREATE POLICY "Users can view members of their organizations" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
  );

CREATE POLICY "Owners and admins can manage members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organization_members.organization_id
      AND role IN ('owner', 'admin')
    )
  );

-- Update organizations policies
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organization" ON organizations;

CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM get_user_organizations()
    )
  );

CREATE POLICY "Owners can update their organization" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM get_user_organizations()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organizations.id
      AND role = 'owner'
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

-- 2. Ensure Invitations Table Exists
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(organization_id, email)
);

-- Enable RLS on invitations
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Invitations Policies
DROP POLICY IF EXISTS "Owners and admins can view invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can create invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON organization_invitations;

CREATE POLICY "Owners and admins can view invitations" ON organization_invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organization_invitations.organization_id
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can create invitations" ON organization_invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organization_invitations.organization_id
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete invitations" ON organization_invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organization_invitations.organization_id
      AND role IN ('owner', 'admin')
    )
  );
