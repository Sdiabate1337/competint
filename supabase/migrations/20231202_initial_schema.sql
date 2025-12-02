-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users and roles (extends auth.users from Supabase)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_regions TEXT[] DEFAULT '{}',
  industries TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt templates table
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search runs table
CREATE TABLE search_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  prompt_template_id UUID REFERENCES prompt_templates(id),
  regions TEXT[] NOT NULL,
  keywords TEXT[] NOT NULL,
  results_count INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10,2),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Competitors table with pgvector embeddings
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  search_run_id UUID REFERENCES search_runs(id),
  name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  business_model TEXT,
  value_proposition TEXT,
  traction_level TEXT,
  industry TEXT,
  country TEXT,
  region TEXT,
  founded_year INTEGER,
  founders TEXT[],
  funding_raised DECIMAL(15,2),
  funding_currency TEXT DEFAULT 'USD',
  employee_count INTEGER,
  technologies TEXT[],
  links JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),  -- OpenAI ada-002 dimension
  validation_status TEXT CHECK (validation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON competitors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes for performance
CREATE INDEX idx_competitors_org_id ON competitors(organization_id);
CREATE INDEX idx_competitors_validation_status ON competitors(validation_status);
CREATE INDEX idx_competitors_region ON competitors(region);
CREATE INDEX idx_competitors_country ON competitors(country);
CREATE INDEX idx_competitors_industry ON competitors(industry);
CREATE INDEX idx_search_runs_project_id ON search_runs(project_id);
CREATE INDEX idx_search_runs_status ON search_runs(status);
CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);

-- Discovery queue table (for BullMQ jobs tracking)
CREATE TABLE discovery_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_run_id UUID REFERENCES search_runs(id) ON DELETE CASCADE,
  job_id TEXT,  -- BullMQ job ID
  country TEXT NOT NULL,
  status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_discovery_queue_run_id ON discovery_queue(search_run_id);
CREATE INDEX idx_discovery_queue_status ON discovery_queue(status);

-- Billing and invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  status TEXT CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')) DEFAULT 'pending',
  payment_method TEXT,  -- 'wave', 'orange_money', 'mtn', etc.
  payment_provider TEXT,  -- 'flutterwave', 'paystack', etc.
  provider_transaction_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_invoices_org_id ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- API usage and quotas
CREATE TABLE organization_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  api_calls_limit INTEGER DEFAULT 1000,
  api_calls_used INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_competitors(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  org_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    name,
    description,
    1 - (embedding <=> query_embedding) as similarity
  FROM competitors
  WHERE organization_id = org_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
