/**
 * ourpage Keepsake Database Engine — Strict Supabase Live Cloud
 * 
 * DESIGN PRINCIPLE:
 * 100% Direct Live Cloud Database via Supabase PostgreSQL.
 * Local files/fallbacks are completely disabled and bypassed.
 * Template 1 (LoveOS) stores directly to Supabase Table: "loveos_projects".
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.resolve(__dirname);
function loadLocalEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    } catch (_) {}
  }
}
loadLocalEnv();


// =============================================================================
// TEMPLATE REGISTRY (ISOLATED LIVE CLOUD TABLES PER TEMPLATE)
// =============================================================================
const TEMPLATE_REGISTRY = {
  loveos: {
    name: 'LoveOS (iOS Keepsake)',
    table: 'loveos_projects',
    defaultTemplate: 'loveos'
  }
  // Di masa depan untuk Template 2:
  // template2: {
  //   name: 'Template 2',
  //   table: 'template2_projects',
  //   defaultTemplate: 'template2'
  // }
};

// Supabase Environment Configurations
const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_URL = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ourpage DB] FATAL: SUPABASE_URL or SUPABASE_KEY is missing from environment!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

console.log('[ourpage DB] Connected directly to Supabase Cloud PostgreSQL');

function normalizeProjectRow(p, defaultTemplate = 'loveos') {
  if (!p) return null;
  const config = p.config_data || p.configData || p.config || {};
  return {
    id: p.id,
    slug: p.slug,
    email: p.email,
    template: p.template || defaultTemplate,
    designCode: p.design_code || p.designCode || (p.id ? `OP-${p.id.slice(-6).toUpperCase()}` : 'OP-100000'),
    configData: typeof config === 'string' ? JSON.parse(config) : config,
    status: p.status || 'draft',
    followupSent: Boolean(p.followup_sent || p.followupSent),
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
    updatedAt: p.updated_at || p.updatedAt || new Date().toISOString(),
    expiresAt: p.expires_at || p.expiresAt || null
  };
}

function getTemplateConfig(templateKey = 'loveos') {
  const key = String(templateKey || 'loveos').toLowerCase().trim();
  return TEMPLATE_REGISTRY[key] || TEMPLATE_REGISTRY.loveos;
}

// =============================================================================
// STRICT LIVE SUPABASE DATABASE OPERATIONS
// =============================================================================

/**
 * Get project by slug from Supabase Cloud table
 */
async function getProjectBySlug(slug, template = null) {
  if (!slug) return null;
  const cleanSlug = String(slug).trim().toLowerCase();
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);

  for (const tConf of targets) {
    try {
      const { data, error } = await supabase
        .from(tConf.table)
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (!error && data) {
        return normalizeProjectRow(data, tConf.defaultTemplate);
      }
      if (error && error.code === '42P01') {
        console.error(`[ourpage DB] Table "${tConf.table}" not found in Supabase! Please execute supabase_loveos_schema.sql in Supabase SQL editor.`);
      }
    } catch (e) {
      console.error(`[ourpage DB] getProjectBySlug error on "${tConf.table}":`, e.message);
    }
  }

  return null;
}

/**
 * Get project by ID from Supabase Cloud table
 */
async function getProjectById(id, template = null) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);

  for (const tConf of targets) {
    try {
      const { data, error } = await supabase
        .from(tConf.table)
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return normalizeProjectRow(data, tConf.defaultTemplate);
      }
    } catch (e) {
      console.error(`[ourpage DB] getProjectById error on "${tConf.table}":`, e.message);
    }
  }

  return null;
}

/**
 * Check if a URL slug is available across registered Supabase template tables
 */
async function checkSlugAvailable(slug, excludeId = null, template = null) {
  if (!slug) return false;
  const cleanSlug = String(slug).trim().toLowerCase();
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);

  for (const tConf of targets) {
    try {
      let query = supabase
        .from(tConf.table)
        .select('id')
        .eq('slug', cleanSlug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return false;
      }
    } catch (e) {
      console.error(`[ourpage DB] checkSlugAvailable error:`, e.message);
    }
  }

  return true;
}

/**
 * Save Draft directly into Supabase Cloud table (strictly live)
 */
async function saveDraft({ id, slug, email, template = 'loveos', configData, designCode }) {
  const now = new Date().toISOString();
  const cleanSlug = String(slug).trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanTemplate = String(template || 'loveos').trim().toLowerCase();
  const payloadConfig = configData || {};

  const tConf = getTemplateConfig(cleanTemplate);

  // Check existing in Supabase template table
  const { data: existing } = await supabase
    .from(tConf.table)
    .select('id')
    .or(`id.eq.${id},slug.eq.${cleanSlug}`)
    .maybeSingle();

  const dbRecord = {
    id: id,
    slug: cleanSlug,
    email: cleanEmail,
    template: cleanTemplate,
    design_code: designCode || `OP-${id.slice(-6).toUpperCase()}`,
    config_data: payloadConfig,
    status: 'draft',
    followup_sent: false,
    updated_at: now
  };

  if (existing) {
    const { data, error } = await supabase
      .from(tConf.table)
      .update(dbRecord)
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`[ourpage DB] Supabase update failed on "${tConf.table}":`, error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }
    return normalizeProjectRow(data, tConf.defaultTemplate);
  } else {
    dbRecord.created_at = now;
    const { data, error } = await supabase
      .from(tConf.table)
      .insert(dbRecord)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`[ourpage DB] Supabase insert failed on "${tConf.table}":`, error.message);
      if (error.code === '42P01') {
        throw new Error(`Tabel "${tConf.table}" belum dibuat di Supabase. Silakan jalankan query di supabase_loveos_schema.sql pada Supabase SQL Editor.`);
      }
      throw new Error(`Supabase error: ${error.message}`);
    }
    return normalizeProjectRow(data, tConf.defaultTemplate);
  }
}

/**
 * Update project status in Supabase Cloud table
 */
async function updateProjectStatus(identifier, { status, expiresAt, configData, followupSent }, template = null) {
  const now = new Date().toISOString();
  const cleanId = String(identifier).trim();
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);

  for (const tConf of targets) {
    try {
      const updatePayload = { updated_at: now };
      if (status !== undefined) updatePayload.status = status;
      if (expiresAt !== undefined) updatePayload.expires_at = expiresAt;
      if (configData !== undefined) updatePayload.config_data = configData;
      if (followupSent !== undefined) updatePayload.followup_sent = Boolean(followupSent);

      const { data, error } = await supabase
        .from(tConf.table)
        .update(updatePayload)
        .or(`id.eq.${cleanId},slug.eq.${cleanId.toLowerCase()}`)
        .select()
        .maybeSingle();

      if (!error && data) {
        return normalizeProjectRow(data, tConf.defaultTemplate);
      }
    } catch (e) {
      console.error(`[ourpage DB] updateProjectStatus error:`, e.message);
    }
  }

  return null;
}

/**
 * Mark followup as sent
 */
async function markFollowupSent(id, template = null) {
  return updateProjectStatus(id, { followupSent: true }, template);
}

/**
 * Get all projects directly from Supabase Cloud
 */
async function getAllProjects({ status, search, template = null } = {}) {
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);
  const results = [];

  for (const tConf of targets) {
    try {
      let query = supabase
        .from(tConf.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search) {
        const s = `%${search.trim().toLowerCase()}%`;
        query = query.or(`email.ilike.${s},slug.ilike.${s}`);
      }

      const { data, error } = await query;
      if (!error && data) {
        results.push(...data.map(r => normalizeProjectRow(r, tConf.defaultTemplate)));
      } else if (error) {
        console.warn(`[ourpage DB] getAllProjects warning on "${tConf.table}":`, error.message);
      }
    } catch (e) {
      console.error(`[ourpage DB] getAllProjects exception:`, e.message);
    }
  }

  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get abandoned drafts (>1 hour old) from Supabase Cloud
 */
async function getAbandonedDrafts(hoursOld = 1, template = null) {
  const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);
  const results = [];

  for (const tConf of targets) {
    try {
      const { data, error } = await supabase
        .from(tConf.table)
        .select('*')
        .eq('status', 'draft')
        .eq('followup_sent', false)
        .lte('created_at', cutoffTime);

      if (!error && data) {
        results.push(...data.map(r => normalizeProjectRow(r, tConf.defaultTemplate)));
      }
    } catch (e) {
      console.error(`[ourpage DB] getAbandonedDrafts exception:`, e.message);
    }
  }

  return results;
}

/**
 * Find project for Gumroad webhook directly from Supabase Cloud
 */
async function findProjectForGumroadWebhook({ slug, id, email, template = null }) {
  const targets = template ? [getTemplateConfig(template)] : Object.values(TEMPLATE_REGISTRY);

  for (const tConf of targets) {
    try {
      if (slug) {
        const { data } = await supabase.from(tConf.table).select('*').eq('slug', String(slug).toLowerCase()).maybeSingle();
        if (data) return normalizeProjectRow(data, tConf.defaultTemplate);
      }
      if (id) {
        const { data } = await supabase.from(tConf.table).select('*').eq('id', id).maybeSingle();
        if (data) return normalizeProjectRow(data, tConf.defaultTemplate);
      }
      if (email) {
        const { data } = await supabase
          .from(tConf.table)
          .select('*')
          .eq('email', String(email).toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return normalizeProjectRow(data, tConf.defaultTemplate);
      }
    } catch (e) {
      console.error(`[ourpage DB] findProjectForGumroadWebhook error:`, e.message);
    }
  }

  return null;
}

module.exports = {
  isUsingSupabase: () => true,
  TEMPLATE_REGISTRY,
  getProjectBySlug,
  getProjectById,
  checkSlugAvailable,
  saveDraft,
  updateProjectStatus,
  markFollowupSent,
  getAllProjects,
  getAbandonedDrafts,
  findProjectForGumroadWebhook
};
