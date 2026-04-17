-- ============================================================
-- CALL STREAM AI - Complete Database Schema
-- Production-grade multi-tenant SaaS for AI voice operations
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients (tenants)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  vertical TEXT NOT NULL CHECK (vertical IN ('hotels_resorts', 'travel', 'food_beverage', 'entertainment', 'recreation_wellness')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'archived')),
  settings JSONB DEFAULT '{}',
  owner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client-user membership
CREATE TABLE public.client_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, user_id)
);

-- ============================================================
-- 2. VERTICAL TEMPLATE TABLES
-- ============================================================

CREATE TABLE public.vertical_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vertical TEXT NOT NULL UNIQUE CHECK (vertical IN ('hotels_resorts', 'travel', 'food_beverage', 'entertainment', 'recreation_wellness')),
  name TEXT NOT NULL,
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vertical_template_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.vertical_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vertical_template_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.vertical_templates(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL,
  intent_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vertical_template_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.vertical_templates(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL,
  intent_key TEXT,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('time_based', 'intent_match', 'fallback', 'overflow', 'closed')),
  action_type TEXT NOT NULL CHECK (action_type IN ('transfer', 'send_sms_link', 'voicemail', 'info_response', 'escalate', 'custom')),
  action_label TEXT,
  action_value TEXT,
  priority INT NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vertical_template_kb_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.vertical_templates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  department_code TEXT,
  intent_key TEXT,
  tags TEXT[] DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vertical_template_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.vertical_templates(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. RUNTIME TABLES (Client-specific, read-optimized)
-- ============================================================

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, code)
);

CREATE TABLE public.directory_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  extension TEXT,
  email TEXT,
  entry_type TEXT NOT NULL DEFAULT 'department' CHECK (entry_type IN ('department', 'person', 'service', 'external')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.hours_of_operation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.holiday_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  department_code TEXT,
  intent_key TEXT,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('time_based', 'intent_match', 'fallback', 'overflow', 'closed')),
  condition_data JSONB DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('transfer', 'send_sms_link', 'voicemail', 'info_response', 'escalate', 'custom')),
  action_label TEXT,
  action_value TEXT,
  action_data JSONB DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  department_code TEXT,
  intent_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  examples TEXT[] DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, intent_key)
);

CREATE TABLE public.kb_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  department_code TEXT,
  intent_key TEXT,
  tags TEXT[] DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. BRAINBASE INTEGRATION TABLES
-- ============================================================

CREATE TABLE public.deployment_bindings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  brainbase_worker_id TEXT NOT NULL,
  brainbase_deployment_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'voice' CHECK (channel IN ('voice', 'chat', 'sms', 'email')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brainbase_deployment_id, channel, environment)
);

CREATE TABLE public.deployment_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_binding_id UUID NOT NULL REFERENCES public.deployment_bindings(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('routing', 'hours', 'kb', 'directory', 'intents', 'prompt_hints')),
  override_data JSONB NOT NULL DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.channel_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('voice', 'chat', 'sms', 'email')),
  override_type TEXT NOT NULL CHECK (override_type IN ('routing', 'hours', 'kb', 'prompt_hints', 'response_format')),
  override_data JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.published_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  published_by UUID REFERENCES public.users(id),
  snapshot JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cache_invalidation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('publish', 'update', 'deployment_change', 'manual')),
  affected_keys TEXT[] DEFAULT '{}',
  triggered_by UUID REFERENCES public.users(id),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ADMIN / IMPORT TABLES
-- ============================================================

CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsing', 'mapping', 'validating', 'ready', 'approved', 'processing', 'completed', 'failed')),
  file_name TEXT NOT NULL,
  file_url TEXT,
  total_rows INT DEFAULT 0,
  valid_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  field_mapping JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.import_job_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_data JSONB NOT NULL,
  mapped_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'error', 'imported')),
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.import_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INT,
  field TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  raw_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.draft_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  draft_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'published')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. INDEXES (Hot path optimization)
-- ============================================================

-- Deployment binding lookups (most critical for runtime)
CREATE INDEX idx_deployment_bindings_lookup ON public.deployment_bindings(brainbase_deployment_id, channel, environment) WHERE is_active = TRUE;
CREATE INDEX idx_deployment_bindings_worker ON public.deployment_bindings(brainbase_worker_id) WHERE is_active = TRUE;
CREATE INDEX idx_deployment_bindings_client ON public.deployment_bindings(client_id) WHERE is_active = TRUE;

-- Runtime table indexes
CREATE INDEX idx_departments_client ON public.departments(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_departments_client_code ON public.departments(client_id, code) WHERE is_active = TRUE;
CREATE INDEX idx_directory_client ON public.directory_entries(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_directory_department ON public.directory_entries(department_id) WHERE is_active = TRUE;
CREATE INDEX idx_hours_client ON public.hours_of_operation(client_id);
CREATE INDEX idx_hours_department ON public.hours_of_operation(department_id);
CREATE INDEX idx_hours_client_day ON public.hours_of_operation(client_id, day_of_week);
CREATE INDEX idx_holiday_client ON public.holiday_exceptions(client_id);
CREATE INDEX idx_holiday_client_date ON public.holiday_exceptions(client_id, date);
CREATE INDEX idx_routing_client ON public.routing_rules(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_routing_client_dept ON public.routing_rules(client_id, department_code) WHERE is_active = TRUE;
CREATE INDEX idx_routing_client_intent ON public.routing_rules(client_id, intent_key) WHERE is_active = TRUE;
CREATE INDEX idx_routing_client_dept_intent ON public.routing_rules(client_id, department_code, intent_key) WHERE is_active = TRUE;
CREATE INDEX idx_intents_client ON public.intents(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_intents_client_key ON public.intents(client_id, intent_key) WHERE is_active = TRUE;
CREATE INDEX idx_intents_client_dept ON public.intents(client_id, department_code) WHERE is_active = TRUE;
CREATE INDEX idx_kb_client ON public.kb_items(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_kb_client_category ON public.kb_items(client_id, category) WHERE is_active = TRUE;
CREATE INDEX idx_kb_client_dept ON public.kb_items(client_id, department_code) WHERE is_active = TRUE;
CREATE INDEX idx_kb_client_intent ON public.kb_items(client_id, intent_key) WHERE is_active = TRUE;

-- Brainbase integration indexes
CREATE INDEX idx_deployment_overrides_binding ON public.deployment_overrides(deployment_binding_id) WHERE is_active = TRUE;
CREATE INDEX idx_channel_overrides_client ON public.channel_overrides(client_id, channel) WHERE is_active = TRUE;
CREATE INDEX idx_published_versions_client ON public.published_versions(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_cache_events_unprocessed ON public.cache_invalidation_events(client_id) WHERE processed = FALSE;

-- Admin indexes
CREATE INDEX idx_import_jobs_client ON public.import_jobs(client_id);
CREATE INDEX idx_import_job_rows_job ON public.import_job_rows(import_job_id);
CREATE INDEX idx_audit_logs_client ON public.audit_logs(client_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_client_members_user ON public.client_members(user_id);
CREATE INDEX idx_client_members_client ON public.client_members(client_id);

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours_of_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY users_self_read ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_self_update ON public.users FOR UPDATE USING (auth.uid() = id);

-- Client access through membership
CREATE POLICY clients_member_read ON public.clients FOR SELECT 
  USING (id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));
CREATE POLICY clients_member_write ON public.clients FOR ALL
  USING (id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Multi-tenant RLS for all client-scoped tables
CREATE POLICY departments_tenant ON public.departments FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY directory_tenant ON public.directory_entries FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY hours_tenant ON public.hours_of_operation FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY holidays_tenant ON public.holiday_exceptions FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY routing_tenant ON public.routing_rules FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY intents_tenant ON public.intents FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY kb_tenant ON public.kb_items FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY deployments_tenant ON public.deployment_bindings FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY deployment_overrides_tenant ON public.deployment_overrides FOR ALL
  USING (deployment_binding_id IN (
    SELECT db.id FROM public.deployment_bindings db 
    JOIN public.client_members cm ON db.client_id = cm.client_id 
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY channel_overrides_tenant ON public.channel_overrides FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY published_tenant ON public.published_versions FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY imports_tenant ON public.import_jobs FOR ALL
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

CREATE POLICY import_rows_tenant ON public.import_job_rows FOR ALL
  USING (import_job_id IN (
    SELECT ij.id FROM public.import_jobs ij 
    JOIN public.client_members cm ON ij.client_id = cm.client_id 
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY audit_tenant ON public.audit_logs FOR SELECT
  USING (client_id IN (SELECT client_id FROM public.client_members WHERE user_id = auth.uid()));

-- Service role bypass for runtime API (backend uses service key)
CREATE POLICY service_role_all_clients ON public.clients FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_departments ON public.departments FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_directory ON public.directory_entries FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_hours ON public.hours_of_operation FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_holidays ON public.holiday_exceptions FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_routing ON public.routing_rules FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_intents ON public.intents FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_kb ON public.kb_items FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_bindings ON public.deployment_bindings FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_overrides ON public.deployment_overrides FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_channel ON public.channel_overrides FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_published ON public.published_versions FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_cache ON public.cache_invalidation_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_imports ON public.import_jobs FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_import_rows ON public.import_job_rows FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_errors ON public.import_errors FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_audit ON public.audit_logs FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_drafts ON public.draft_versions FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true);
CREATE POLICY service_role_all_members ON public.client_members FOR ALL TO service_role USING (true);

-- ============================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_directory_updated BEFORE UPDATE ON public.directory_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_hours_updated BEFORE UPDATE ON public.hours_of_operation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_holidays_updated BEFORE UPDATE ON public.holiday_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_routing_updated BEFORE UPDATE ON public.routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_intents_updated BEFORE UPDATE ON public.intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();  
CREATE TRIGGER tr_kb_updated BEFORE UPDATE ON public.kb_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_deployment_bindings_updated BEFORE UPDATE ON public.deployment_bindings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_deployment_overrides_updated BEFORE UPDATE ON public.deployment_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_import_jobs_updated BEFORE UPDATE ON public.import_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
