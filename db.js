/**
 * studio.402 Keepsake Database Engine
 * 
 * Supports:
 * 1. Supabase PostgreSQL (Cloud Production - Free Tier)
 * 2. Local Fallback Store (Local Dev & Offline Testing)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT_DIR = path.resolve(__dirname);
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(ROOT_DIR, 'data');
const LOCAL_JSON_FILE = path.join(DATA_DIR, 'projects.json');

// Supabase Environment Configurations
const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_URL = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

let supabase = null;
let isUsingSupabase = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    isUsingSupabase = true;
    console.log('[studio.402 DB] Connected to Supabase Cloud PostgreSQL');
  } catch (err) {
    console.warn('[studio.402 DB] Failed to init Supabase client, falling back to local store:', err.message);
  }
} else {
  console.log('[studio.402 DB] SUPABASE_URL not configured. Operating in Local Store Fallback mode.');
}

// =============================================================================
// LOCAL FALLBACK HELPERS
// =============================================================================
function ensureLocalStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_JSON_FILE)) {
    fs.writeFileSync(LOCAL_JSON_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function loadLocalProjects() {
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(LOCAL_JSON_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[studio.402 DB] Error reading local store:', err.message);
    return [];
  }
}

function saveLocalProjects(projects) {
  ensureLocalStore();
  try {
    const tempFile = `${LOCAL_JSON_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(projects, null, 2), 'utf8');
    fs.renameSync(tempFile, LOCAL_JSON_FILE);
    return true;
  } catch (err) {
    console.error('[studio.402 DB] Error saving local store:', err.message);
    return false;
  }
}

function normalizeProjectRow(p) {
  if (!p) return null;
  const config = p.config_data || p.configData || p.config || {};
  return {
    id: p.id,
    slug: p.slug,
    email: p.email,
    template: p.template || 'spotilove',
    designCode: p.design_code || p.designCode || (p.id ? `ST-${p.id.slice(-6).toUpperCase()}` : 'ST-402000'),
    configData: typeof config === 'string' ? JSON.parse(config) : config,
    status: p.status || 'draft',
    followupSent: Boolean(p.followup_sent || p.followupSent),
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
    updatedAt: p.updated_at || p.updatedAt || new Date().toISOString(),
    expiresAt: p.expires_at || p.expiresAt || null
  };
}

// =============================================================================
// UNIFIED DATABASE INTERFACE
// =============================================================================

async function getProjectBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = String(slug).trim().toLowerCase();

  if (isUsingSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (!error && data) {
        return normalizeProjectRow(data);
      }
      if (error) {
        console.warn('[studio.402 DB] Supabase getProjectBySlug warning:', error.message);
      }
    } catch (e) {
      console.warn('[studio.402 DB] Supabase getProjectBySlug error:', e.message);
    }
  }

  // Fallback to local
  const projects = loadLocalProjects();
  const found = projects.find(p => (p.slug || '').toLowerCase() === cleanSlug);
  return normalizeProjectRow(found);
}

async function getProjectById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();

  if (isUsingSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return normalizeProjectRow(data);
      }
      if (error) {
        console.warn('[studio.402 DB] Supabase getProjectById warning:', error.message);
      }
    } catch (e) {
      console.warn('[studio.402 DB] Supabase getProjectById error:', e.message);
    }
  }

  // Fallback to local
  const projects = loadLocalProjects();
  const found = projects.find(p => p.id === cleanId);
  return normalizeProjectRow(found);
}

async function checkSlugAvailable(slug, excludeId = null) {
  if (!slug) return false;
  const cleanSlug = String(slug).trim().toLowerCase();

  if (isUsingSupabase && supabase) {
    try {
      let query = supabase
        .from('projects')
        .select('id')
        .eq('slug', cleanSlug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;
      if (!error && data) {
        if (data.length > 0) return false;
      }
    } catch (e) {
      console.warn('[studio.402 DB] checkSlugAvailable Supabase check error:', e.message);
    }
  }

  // Also check local store
  const projects = loadLocalProjects();
  const match = projects.find(p => (p.slug || '').toLowerCase() === cleanSlug && p.id !== excludeId);
  return !match;
}

async function saveDraft({ id, slug, email, template, configData, designCode }) {
  const now = new Date().toISOString();
  const cleanSlug = String(slug).trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanTemplate = String(template || 'spotilove').trim();
  const payloadConfig = configData || {};

  if (isUsingSupabase && supabase) {
    try {
      // Check if project exists by id or slug
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .or(`id.eq.${id},slug.eq.${cleanSlug}`)
        .maybeSingle();

      const dbRecord = {
        id: id,
        slug: cleanSlug,
        email: cleanEmail,
        template: cleanTemplate,
        config_data: payloadConfig,
        status: 'draft',
        followup_sent: false,
        updated_at: now
      };

      if (existing) {
        const { data, error } = await supabase
          .from('projects')
          .update(dbRecord)
          .eq('id', existing.id)
          .select()
          .maybeSingle();

        if (error) {
          console.warn(`[studio.402 DB] Supabase saveDraft update failed: ${error.message}`);
          if (error.code === '42501') {
            console.warn(`[studio.402 DB] TIP: Table "projects" has RLS active. Run in Supabase SQL Editor: ALTER TABLE projects DISABLE ROW LEVEL SECURITY;`);
          }
        } else if (data) {
          return normalizeProjectRow(data);
        }
      } else {
        dbRecord.created_at = now;
        const { data, error } = await supabase
          .from('projects')
          .insert(dbRecord)
          .select()
          .maybeSingle();

        if (error) {
          console.warn(`[studio.402 DB] Supabase saveDraft insert failed: ${error.message}`);
          if (error.code === '42501') {
            console.warn(`[studio.402 DB] TIP: Table "projects" has RLS active. Run in Supabase SQL Editor: ALTER TABLE projects DISABLE ROW LEVEL SECURITY;`);
          }
        } else if (data) {
          return normalizeProjectRow(data);
        }
      }
    } catch (err) {
      console.warn(`[studio.402 DB] Supabase saveDraft exception: ${err.message}`);
    }
  }

  // Fallback to local
  const projects = loadLocalProjects();
  const existingIdx = projects.findIndex(p => p.id === id || (p.slug || '').toLowerCase() === cleanSlug);

  const localProject = {
    id: id,
    slug: cleanSlug,
    email: cleanEmail,
    template: cleanTemplate,
    designCode: designCode || `ST-${id.slice(-6).toUpperCase()}`,
    configData: payloadConfig,
    status: 'draft',
    followupSent: false,
    createdAt: existingIdx >= 0 ? projects[existingIdx].createdAt : now,
    updatedAt: now,
    expiresAt: null
  };

  if (existingIdx >= 0) {
    projects[existingIdx] = { ...projects[existingIdx], ...localProject };
  } else {
    projects.push(localProject);
  }

  saveLocalProjects(projects);
  return normalizeProjectRow(localProject);
}

async function updateProjectStatus(identifier, { status, expiresAt, configData, followupSent }) {
  const now = new Date().toISOString();

  if (isUsingSupabase && supabase) {
    try {
      const updatePayload = { updated_at: now };
      if (status !== undefined) updatePayload.status = status;
      if (expiresAt !== undefined) updatePayload.expires_at = expiresAt;
      if (configData !== undefined) updatePayload.config_data = configData;
      if (followupSent !== undefined) updatePayload.followup_sent = Boolean(followupSent);

      const { data, error } = await supabase
        .from('projects')
        .update(updatePayload)
        .or(`id.eq.${identifier},slug.eq.${String(identifier).toLowerCase()}`)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[studio.402 DB] updateProjectStatus warning:', error.message);
      } else if (data) {
        return normalizeProjectRow(data);
      }
    } catch (e) {
      console.warn('[studio.402 DB] updateProjectStatus error:', e.message);
    }
  }

  // Fallback to local
  const projects = loadLocalProjects();
  const cleanId = String(identifier).toLowerCase();
  const idx = projects.findIndex(p => p.id === identifier || (p.slug || '').toLowerCase() === cleanId);

  if (idx === -1) return null;

  if (status !== undefined) projects[idx].status = status;
  if (expiresAt !== undefined) projects[idx].expiresAt = expiresAt;
  if (configData !== undefined) projects[idx].configData = configData;
  if (followupSent !== undefined) projects[idx].followupSent = Boolean(followupSent);
  projects[idx].updatedAt = now;

  saveLocalProjects(projects);
  return normalizeProjectRow(projects[idx]);
}

async function markFollowupSent(id) {
  return updateProjectStatus(id, { followupSent: true });
}

async function getAllProjects({ status, search } = {}) {
  let supabaseList = [];
  if (isUsingSupabase && supabase) {
    try {
      let query = supabase
        .from('projects')
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
        supabaseList = data.map(normalizeProjectRow);
      } else if (error) {
        console.warn('[studio.402 DB] getAllProjects Supabase warning:', error.message);
      }
    } catch (e) {
      console.warn('[studio.402 DB] getAllProjects Supabase error:', e.message);
    }
  }

  // Also read local projects and merge (deduplicate by id or slug)
  let localList = loadLocalProjects();
  if (status && status !== 'all') {
    localList = localList.filter(p => p.status === status);
  }
  if (search) {
    const q = search.trim().toLowerCase();
    localList = localList.filter(p => 
      (p.email || '').toLowerCase().includes(q) || 
      (p.slug || '').toLowerCase().includes(q) ||
      (p.designCode || '').toLowerCase().includes(q)
    );
  }
  localList = localList.map(normalizeProjectRow);

  // Combine and deduplicate
  const mergedMap = new Map();
  for (const item of supabaseList) {
    mergedMap.set(item.id, item);
  }
  for (const item of localList) {
    if (!mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getAbandonedDrafts(hoursOld = 1) {
  const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
  let supabaseList = [];

  if (isUsingSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'draft')
        .eq('followup_sent', false)
        .lte('created_at', cutoffTime);

      if (!error && data) {
        supabaseList = data.map(normalizeProjectRow);
      } else if (error) {
        console.warn('[studio.402 DB] getAbandonedDrafts Supabase warning:', error.message);
      }
    } catch (e) {
      console.warn('[studio.402 DB] getAbandonedDrafts Supabase error:', e.message);
    }
  }

  // Also check local store
  const localProjects = loadLocalProjects();
  const localList = localProjects
    .filter(p => p.status === 'draft' && !p.followupSent && new Date(p.createdAt) <= new Date(cutoffTime))
    .map(normalizeProjectRow);

  const mergedMap = new Map();
  for (const item of supabaseList) {
    mergedMap.set(item.id, item);
  }
  for (const item of localList) {
    if (!mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }

  return Array.from(mergedMap.values());
}

async function findProjectForGumroadWebhook({ slug, id, email }) {
  if (isUsingSupabase && supabase) {
    try {
      // 1. Try slug
      if (slug) {
        const { data } = await supabase.from('projects').select('*').eq('slug', String(slug).toLowerCase()).maybeSingle();
        if (data) return normalizeProjectRow(data);
      }
      // 2. Try id
      if (id) {
        const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
        if (data) return normalizeProjectRow(data);
      }
      // 3. Try latest draft by email
      if (email) {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('email', String(email).toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return normalizeProjectRow(data);
      }
    } catch (e) {
      console.warn('[studio.402 DB] findProjectForGumroadWebhook Supabase error:', e.message);
    }
  }

  // Fallback to local
  const projects = loadLocalProjects();
  if (slug) {
    const clean = String(slug).toLowerCase();
    const found = projects.find(p => (p.slug || '').toLowerCase() === clean);
    if (found) return normalizeProjectRow(found);
  }
  if (id) {
    const found = projects.find(p => p.id === id);
    if (found) return normalizeProjectRow(found);
  }
  if (email) {
    const cleanEmail = String(email).toLowerCase();
    const found = projects
      .filter(p => (p.email || '').toLowerCase() === cleanEmail)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (found) return normalizeProjectRow(found);
  }
  return null;
}

module.exports = {
  isUsingSupabase: () => isUsingSupabase,
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

