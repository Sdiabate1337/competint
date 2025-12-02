# Supabase Migrations

This directory contains SQL migrations for the Competitive Intelligence SaaS database.

## Applying Migrations

### Using Supabase CLI

1. **Install Supabase CLI** (if not already installed):
```bash
npm install -g supabase
```

2. **Link to your Supabase project**:
```bash
supabase link --project-ref your-project-ref
```

3. **Apply migrations**:
```bash
supabase db push
```

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file in order:
   - `20231202_initial_schema.sql`
   - `20231202_rls_policies.sql`
4. Execute each migration

## Migration Files

### 20231202_initial_schema.sql
- Enables pgvector extension for semantic search
- Creates all tables (organizations, projects, competitors, etc.)
- Sets up indexes for performance
- Creates vector similarity search function
- Adds triggers for updated_at timestamps

### 20231202_rls_policies.sql
- Enables Row Level Security on all tables
- Creates policies for multi-tenant data isolation
- Implements role-based access control (owner, admin, member, viewer)

## Testing Migrations

After applying migrations, you can test with sample data:

```sql
-- Create a test organization
INSERT INTO organizations (name, slug) VALUES ('Test Startup', 'test-startup');

-- Add yourself as owner (replace with your auth.users UUID)
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'test-startup'),
  'your-user-uuid',
  'owner'
);

-- Create a test project
INSERT INTO projects (organization_id, name, target_regions, industries)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'test-startup'),
  'Fintech Competitors',
  ARRAY['West Africa', 'East Africa'],
  ARRAY['Fintech', 'Mobile Money']
);
```

## pgvector Setup

The migrations automatically install and configure pgvector for semantic search. The `match_competitors` function uses cosine similarity to find similar competitors based on embeddings.

**Usage example:**
```sql
SELECT * FROM match_competitors(
  your_embedding_vector,  -- vector(1536)
  0.8,                    -- similarity threshold
  10,                     -- limit
  'org-uuid'             -- organization_id
);
```

## Important Notes

- **Backup first**: Always backup your database before applying migrations
- **RLS is enabled**: All queries must respect Row Level Security policies
- **Service role**: Worker processes should use the service role key to bypass RLS when needed
- **Vector index**: The ivfflat index improves vector search performance but requires periodic VACUUM
