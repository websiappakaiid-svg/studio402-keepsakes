/**
 * ourpage Keepsake Engine — Production Backend (Modular Multi-Template Architecture)
 * 
 * Features:
 * - Strict Supabase Cloud PostgreSQL with isolated per-template tables (db.js)
 * - Template 1: LoveOS (iOS Romantic Keepsake)
 * - Live WhatsApp Alerts via Fonnte / CallMeBot (notifications.js)
 * - Auto-filled Gumroad checkout URLs & Gumroad Ping Webhook
 * - Automated 1-hour abandoned draft monitoring & follow-up engine
 * - Dynamic /v/:slug keepsake injection
 * - Zero external dependencies beyond @supabase/supabase-js
 * - Node.js and Bun runtime compatible
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');

// Load environment variables from .env if present
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

// Internal Modules
const db = require('./db.js');
const notifications = require('./notifications.js');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const HARDCODED_ADMIN_KEY = '577811Bjs!';
const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim() || HARDCODED_ADMIN_KEY;
const VALID_ADMIN_KEYS = new Set([HARDCODED_ADMIN_KEY, ADMIN_KEY].filter(Boolean));
const GUMROAD_PRODUCT_URL = process.env.GUMROAD_PRODUCT_URL || 'https://threadsmith13.gumroad.com/l/filkd';
const APP_URL = process.env.APP_URL || 'https://studio402-keepsakes.vercel.app';

// =============================================================================
// MODULAR TEMPLATE RESOLUTION MAP
// =============================================================================
const TEMPLATE_MAP = {
  'loveos': 'loveos.html',
  'loveos.html': 'loveos.html',
  'love-os': 'loveos.html'
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'login', 'dashboard', 'preview',
  'editor', 'v', 'data', 'static', 'assets', 'favicon.ico',
  'gumroad-webhook', 'webhook', 'index', 'health', 'ping', 'cron',
  'loveos', 'ourpage'
]);

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, x-admin-key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(new Error('Invalid JSON payload'));
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        resolve(querystring.parse(body));
      } else {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (_) {
          resolve(querystring.parse(body));
        }
      }
    });
    req.on('error', reject);
  });
}

function authenticateAdmin(req) {
  const headerKey = req.headers['x-admin-key'];
  if (headerKey && VALID_ADMIN_KEYS.has(headerKey)) return true;
  
  const authHeader = req.headers['authorization'];
  if (authHeader && VALID_ADMIN_KEYS.has(authHeader.replace(/^Bearer\s+/i, ''))) return true;

  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query && VALID_ADMIN_KEYS.has(parsedUrl.query.key)) return true;

  if (req.headers.cookie) {
    for (const k of VALID_ADMIN_KEYS) {
      if (req.headers.cookie.includes('ourpage_admin=' + encodeURIComponent(k))) return true;
    }
  }

  return false;
}

function buildFollowupMailto(email, slug, previewUrl) {
  const fullPreview = previewUrl.startsWith('http') ? previewUrl : `${APP_URL}${previewUrl}`;
  const subject = encodeURIComponent('Your private keepsake is ready to unlock (15% off inside) ✨');
  const body = encodeURIComponent(
`Hi there,

I noticed you created a romantic digital keepsake for your partner on ourpage:
Preview Link: ${fullPreview}

Your personalized songs, photos, and secret notes are currently saved safely in your private draft.

To help you surprise your partner this week, here is an exclusive 15% discount code for checkout:
Code: FOREVER15 (Save 15% at checkout)

Complete your keepsake here:
${GUMROAD_PRODUCT_URL}?email=${encodeURIComponent(email)}&wanted=true&project_slug=${encodeURIComponent(slug)}

If you need any custom edits or have questions, just reply directly to this email!

Warm regards,
ourpage Keepsakes Team`
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

// =============================================================================
// ABANDONED DRAFTS AUTOMATED MONITOR
// =============================================================================
async function checkAbandonedDrafts() {
  try {
    const abandoned = await db.getAbandonedDrafts(1);
    if (abandoned.length === 0) return 0;

    console.log(`[ourpage Cron] Found ${abandoned.length} abandoned draft(s) older than 1 hour.`);
    
    for (const project of abandoned) {
      const previewUrl = `/v/${project.slug}`;
      const mailtoLink = buildFollowupMailto(project.email, project.slug, previewUrl);

      await notifications.notifyAbandonedDraft({
        email: project.email,
        slug: project.slug,
        previewUrl: previewUrl,
        createdAt: project.createdAt,
        mailtoLink: mailtoLink
      });

      await db.markFollowupSent(project.id, project.template);
    }

    return abandoned.length;
  } catch (err) {
    console.error('[ourpage Cron] Error checking abandoned drafts:', err.message);
    return 0;
  }
}

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const matchedPath = req.headers['x-matched-path'] || '';
  let pathname = parsedUrl.pathname || '/';

  // Normalize Vercel serverless rewrites (when destination is /api)
  if (pathname === '/api') {
    if (parsedUrl.query && parsedUrl.query.route === 'admin') {
      pathname = '/admin';
    } else if (parsedUrl.query && parsedUrl.query.slug) {
      pathname = `/u/${parsedUrl.query.slug}`;
    }
  } else if (matchedPath.startsWith('/admin')) {
    pathname = '/admin';
  } else if (matchedPath.startsWith('/v/') || matchedPath.startsWith('/u/')) {
    pathname = matchedPath.split('?')[0];
  }

  const method = req.method.toUpperCase();
  const searchParams = new URLSearchParams(parsedUrl.query);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, x-admin-key, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  // ---------------------------------------------------------------------------
  // 1. API ROUTES
  // ---------------------------------------------------------------------------

  // GET /api/check-slug?slug=...
  if (pathname === '/api/check-slug' && method === 'GET') {
    const rawSlug = (searchParams.get('slug') || '').trim().toLowerCase();
    
    if (!rawSlug) {
      return sendJson(res, 400, { ok: false, error: 'Slug parameter is required.' });
    }

    if (RESERVED_SLUGS.has(rawSlug)) {
      return sendJson(res, 409, {
        ok: false,
        slug: rawSlug,
        available: false,
        error: `"${rawSlug}" is a reserved system address. Please pick another name.`
      });
    }

    if (!/^[a-z0-9-]+$/.test(rawSlug)) {
      return sendJson(res, 400, {
        ok: false,
        slug: rawSlug,
        available: false,
        error: 'Slug must contain only lowercase letters, numbers, and hyphens.'
      });
    }

    try {
      const isAvailable = await db.checkSlugAvailable(rawSlug);
      if (isAvailable) {
        return sendJson(res, 200, { ok: true, slug: rawSlug, available: true });
      } else {
        return sendJson(res, 409, {
          ok: false,
          slug: rawSlug,
          available: false,
          error: `The link address "${rawSlug}" is already taken. Try adding special dates or your anniversary.`
        });
      }
    } catch (err) {
      console.error('[ourpage] check-slug DB error:', err);
      return sendJson(res, 500, { ok: false, error: 'Database check failed' });
    }
  }

  // POST /api/save-draft
  if ((pathname === '/api/save-draft' || pathname === '/api/loveos/save-draft') && method === 'POST') {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      let slug = (body.slug || '').trim().toLowerCase();
      const template = (body.template || 'loveos').trim().toLowerCase();
      const configData = body.configData || body.config || {};

      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { ok: false, error: 'A valid email address is required.' });
      }

      if (!slug) {
        const emailPrefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
        slug = `${emailPrefix}-${crypto.randomBytes(2).toString('hex')}`;
      }

      if (RESERVED_SLUGS.has(slug)) {
        slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
      }

      const id = body.id || `proj_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const designCode = body.designCode || `OP-${Math.floor(100000 + Math.random() * 900000)}`;

      // Save directly into Supabase Cloud
      const saved = await db.saveDraft({
        id,
        slug,
        email,
        template,
        configData,
        designCode
      });

      const previewUrl = `/u/${saved.slug}`;
      const publicUrl = `/u/${saved.slug}`;
      const reeditUrl = `/editor-loveos.html?slug=${saved.slug}&token=${saved.editToken}`;
      const checkoutUrl = `${GUMROAD_PRODUCT_URL}?email=${encodeURIComponent(saved.email)}&wanted=true&project_id=${encodeURIComponent(saved.id)}&project_slug=${encodeURIComponent(saved.slug)}`;

      // Send Instant WhatsApp Alert to Seller via Fonnte
      notifications.notifyNewDraft({
        email: saved.email,
        slug: saved.slug,
        previewUrl: previewUrl,
        publicUrl: publicUrl,
        reeditUrl: reeditUrl,
        editToken: saved.editToken,
        template: 'LoveOS (iOS Keepsake)',
        designCode: saved.designCode,
        checkoutUrl: checkoutUrl
      }).catch(e => console.warn('[ourpage] Notification error:', e.message));

      return sendJson(res, 200, {
        ok: true,
        id: saved.id,
        slug: saved.slug,
        editToken: saved.editToken,
        expiresAt: saved.expiresAt,
        template: saved.template,
        designCode: saved.designCode,
        status: saved.status,
        previewUrl: previewUrl,
        publicUrl: publicUrl,
        reeditUrl: reeditUrl,
        checkoutUrl: checkoutUrl
      });
    } catch (err) {
      console.error('[ourpage] Error in /api/save-draft:', err);
      return sendJson(res, 500, { ok: false, error: err.message || 'Internal server error saving draft.' });
    }
  }

  // ---------------------------------------------------------------------------
  // VIP RE-EDIT ROUTES (Must precede generic /api/project/:slug)
  // ---------------------------------------------------------------------------
  // GET /api/project/reedit?slug=...&token=... (Authenticate & Load VIP Re-Edit Session)
  if ((pathname === '/api/project/reedit' || pathname.endsWith('/reedit')) && method === 'GET') {
    const slugParam = (searchParams.get('slug') || '').trim().toLowerCase();
    const tokenParam = (searchParams.get('token') || '').trim();

    if (!slugParam || !tokenParam) {
      return sendJson(res, 400, { ok: false, error: 'Both project slug and secret re-edit token are required.' });
    }

    try {
      const project = await db.verifyAndGetReEditProject(slugParam, tokenParam);
      if (!project) {
        return sendJson(res, 401, { ok: false, error: 'Invalid or unauthorized VIP re-edit link. Please check your URL.' });
      }

      if (project.expiresAt && new Date(project.expiresAt).getTime() < Date.now()) {
        return sendJson(res, 410, { ok: false, error: 'This keepsake hosting window has expired. Re-edits are closed.' });
      }

      return sendJson(res, 200, {
        ok: true,
        slug: project.slug,
        email: project.email,
        template: project.template,
        status: project.status,
        expiresAt: project.expiresAt,
        config: project.configData,
        configData: project.configData,
        editToken: tokenParam
      });
    } catch (err) {
      console.error('[ourpage] VIP re-edit auth error:', err);
      return sendJson(res, 500, { ok: false, error: 'Failed to verify VIP re-edit access.' });
    }
  }

  // POST /api/project/reedit or PUT /api/projects/:slug/reedit (Save Live Edits Instantly Without Repayment)
  if ((pathname === '/api/project/reedit' || pathname.endsWith('/reedit')) && (method === 'POST' || method === 'PUT')) {
    try {
      const body = await parseBody(req);
      const slugParam = (body.slug || searchParams.get('slug') || '').trim().toLowerCase();
      const tokenParam = (body.token || body.editToken || searchParams.get('token') || '').trim();
      const configData = body.configData || body.config || {};

      if (!slugParam || !tokenParam) {
        return sendJson(res, 400, { ok: false, error: 'Slug and secret VIP token are required.' });
      }

      const updated = await db.updateReEditProject(slugParam, tokenParam, configData);
      console.log(`[ourpage VIP] Live project "${updated.slug}" updated successfully via VIP token.`);

      return sendJson(res, 200, {
        ok: true,
        slug: updated.slug,
        status: updated.status,
        publicUrl: `/u/${updated.slug}`,
        message: 'Your keepsake changes have been saved & updated live instantly!'
      });
    } catch (err) {
      console.error('[ourpage] Error saving VIP re-edit:', err);
      return sendJson(res, 401, { ok: false, error: err.message || 'Unauthorized re-edit update.' });
    }
  }

  // GET /api/project/:slug or GET /api/project?slug=...
  if ((pathname.startsWith('/api/project/') || pathname === '/api/project') && pathname !== '/api/project/reedit' && !pathname.endsWith('/reedit') && method === 'GET') {
    let slugParam = '';
    if (pathname.startsWith('/api/project/')) {
      slugParam = pathname.split('/api/project/')[1].split('/')[0].split('?')[0];
    } else {
      slugParam = searchParams.get('slug') || searchParams.get('id') || '';
    }

    if (!slugParam) {
      return sendJson(res, 400, { ok: false, error: 'Project identifier (slug or id) required.' });
    }

    try {
      let project = await db.getProjectBySlug(slugParam);
      if (!project) {
        project = await db.getProjectById(slugParam);
      }

      if (!project) {
        return sendJson(res, 404, { ok: false, error: 'Project not found.' });
      }

      if (project.expiresAt) {
        const isExpired = new Date(project.expiresAt).getTime() < Date.now();
        if (isExpired) {
          return sendJson(res, 410, {
            ok: false,
            error: 'This keepsake experience has expired.',
            slug: project.slug,
            expiredAt: project.expiresAt
          });
        }
      }

      const isPreviewDraft = project.status === 'draft';
      const cleanConfig = { ...project.configData, isPreviewDraft };

      return sendJson(res, 200, {
        ok: true,
        id: project.id,
        slug: project.slug,
        template: project.template,
        designCode: project.designCode,
        status: project.status,
        isPreviewDraft: isPreviewDraft,
        createdAt: project.createdAt,
        expiresAt: project.expiresAt,
        config: cleanConfig,
        configData: cleanConfig
      });
    } catch (err) {
      console.error('[ourpage] Error in /api/project:', err);
      return sendJson(res, 500, { ok: false, error: 'Error fetching project.' });
    }
  }

  // POST /api/gumroad-webhook
  if (pathname === '/api/gumroad-webhook' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const buyerEmail = (body.email || body.buyer_email || '').trim().toLowerCase();
      const rawPrice = body.price ? `$${(Number(body.price) / 100).toFixed(2)}` : '$18.00 USD';

      let urlParams = {};
      if (body.url_params) {
        if (typeof body.url_params === 'object') urlParams = body.url_params;
        else {
          try { urlParams = querystring.parse(body.url_params); } catch (_) {}
        }
      }

      const customFields = body.custom_fields || {};
      const targetSlug = (
        urlParams.project_slug ||
        urlParams.custom_slug ||
        body.project_slug ||
        body.custom_slug ||
        customFields.project_slug ||
        customFields.custom_slug ||
        body['custom_fields[custom_slug]'] ||
        body['custom_fields[project_slug]'] ||
        ''
      ).toLowerCase();

      const targetId = (
        urlParams.project_id ||
        body.project_id ||
        customFields.project_id ||
        body['custom_fields[project_id]'] ||
        ''
      );

      console.log(`[ourpage Gumroad] Ping received for email: "${buyerEmail}", slug: "${targetSlug}"`);

      const project = await db.findProjectForGumroadWebhook({
        slug: targetSlug,
        id: targetId,
        email: buyerEmail
      });

      if (!project) {
        console.warn('[ourpage Gumroad] Could not match project for webhook:', { targetSlug, targetId, buyerEmail });
        return sendJson(res, 200, { ok: true, matched: false, message: 'Webhook received but project not found.' });
      }

      // Upgrade project to PAID: 365 days retention
      const retentionDays = 365;
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const updatedConfig = { ...project.configData, isPreviewDraft: false };

      const activated = await db.updateProjectStatus(project.id, {
        status: 'paid',
        expiresAt: expiresAt,
        configData: updatedConfig
      }, project.template);

      const liveUrl = `/u/${activated.slug}`;
      const reeditUrl = `/editor-loveos.html?slug=${activated.slug}&token=${activated.editToken}`;

      notifications.notifyPaidOrder({
        email: activated.email,
        slug: activated.slug,
        liveUrl: liveUrl,
        publicUrl: liveUrl,
        reeditUrl: reeditUrl,
        editToken: activated.editToken,
        price: rawPrice,
        template: 'LoveOS (iOS Keepsake)'
      }).catch(e => console.warn('[ourpage] WA error:', e.message));

      console.log(`[ourpage Gumroad] Project "${activated.slug}" successfully activated!`);
      return sendJson(res, 200, {
        ok: true,
        matched: true,
        activated: true,
        slug: activated.slug,
        status: 'paid',
        publicUrl: liveUrl,
        reeditUrl: reeditUrl
      });
    } catch (err) {
      console.error('[ourpage] Error processing Gumroad webhook:', err);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // GET or POST /api/cron/check-abandoned
  if (pathname === '/api/cron/check-abandoned') {
    try {
      const processedCount = await checkAbandonedDrafts();
      return sendJson(res, 200, {
        ok: true,
        processedCount,
        message: `Processed ${processedCount} abandoned draft(s) older than 1 hour.`
      });
    } catch (err) {
      console.error('[ourpage] Cron error:', err);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // POST /api/admin/test-wa
  if (pathname === '/api/admin/test-wa' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid admin key' });
    }
    const testMsg = `🧪 *[ourpage] WHATSAPP CONNECTION TEST SUCCESSFUL!*\n-----------------------------------\nReal-time WhatsApp alerts are active & connected.\nTimestamp: ${new Date().toISOString()}`;
    await notifications.sendWhatsApp(testMsg);
    return sendJson(res, 200, { ok: true, message: 'Test message dispatched to WhatsApp.' });
  }

  // GET /api/admin/projects
  if (pathname === '/api/admin/projects' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid x-admin-key' });
    }

    try {
      const search = searchParams.get('search') || '';
      const filterStatus = searchParams.get('status') || 'all';

      const allProjects = await db.getAllProjects({ search, status: filterStatus });
      
      const rawAll = await db.getAllProjects();
      const totalDrafts = rawAll.filter(p => p.status === 'draft').length;
      const totalPaid = rawAll.filter(p => p.status === 'paid').length;
      const totalLeads = rawAll.length;
      const conversionRate = totalLeads > 0 ? ((totalPaid / totalLeads) * 100).toFixed(1) : '0.0';

      let estimatedRevenue = 0;
      rawAll.filter(p => p.status === 'paid').forEach(p => {
        estimatedRevenue += 18.00;
      });

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const abandonedCount = rawAll.filter(p => 
        p.status === 'draft' && new Date(p.createdAt).getTime() <= oneHourAgo
      ).length;

      return sendJson(res, 200, {
        ok: true,
        stats: {
          paid: totalPaid,
          drafts: totalDrafts,
          total: totalLeads,
          totalDrafts,
          totalPaid,
          totalLeads,
          conversionRate,
          estimatedRevenue: estimatedRevenue.toFixed(2),
          abandonedCount,
          isUsingSupabase: true
        },
        projects: allProjects
      });
    } catch (err) {
      console.error('[ourpage] Error in /api/admin/projects:', err);
      return sendJson(res, 500, { ok: false, error: 'Error loading admin data.' });
    }
  }

  // POST /api/admin/update-status
  if (pathname === '/api/admin/update-status' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid x-admin-key' });
    }

    try {
      const body = await parseBody(req);
      const { id, slug, status } = body;
      const identifier = id || slug;

      if (!identifier) {
        return sendJson(res, 400, { ok: false, error: 'Project ID or Slug is required.' });
      }

      const updateData = {};
      if (status) updateData.status = status;

      if (body.extendDays) {
        updateData.expiresAt = new Date(Date.now() + Number(body.extendDays) * 24 * 60 * 60 * 1000).toISOString();
      } else if (status === 'paid') {
        updateData.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      const updated = await db.updateProjectStatus(identifier, updateData);
      if (!updated) {
        return sendJson(res, 404, { ok: false, error: 'Project not found.' });
      }

      return sendJson(res, 200, {
        ok: true,
        project: updated,
        message: `Project "${updated.slug}" updated to ${updated.status}.`
      });
    } catch (err) {
      console.error('[ourpage] Error in update-status:', err);
      return sendJson(res, 500, { ok: false, error: 'Error updating project.' });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. DYNAMIC KEEPSAKE RENDERING (/v/:slug and /u/:slug)
  // ---------------------------------------------------------------------------
  if (pathname.startsWith('/v/') || pathname.startsWith('/u/')) {
    const prefix = pathname.startsWith('/u/') ? '/u/' : '/v/';
    const slug = pathname.split(prefix)[1].split('/')[0].split('?')[0].trim().toLowerCase();

    if (!slug) {
      res.writeHead(302, { 'Location': '/' });
      return res.end();
    }

    try {
      const project = await db.getProjectBySlug(slug);

      if (!project) {
        const notFoundHtml = `<!DOCTYPE html>
<html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Keepsake Not Found — ourpage</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;background-color:#08080a;color:#f4f4f5;}</style></head>
<body class="min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-[#121215] border border-zinc-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
    <div class="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400 font-mono text-base font-bold">404</div>
    <div class="space-y-1.5"><h1 class="text-xl font-bold text-white tracking-tight">Keepsake Page Not Found</h1><p class="text-xs text-zinc-400 font-mono">The link &ldquo;${escapeHtml(slug)}&rdquo; has not been created yet or has expired.</p></div>
    <div class="pt-3 flex flex-col gap-2"><a href="/editor" class="py-3 px-5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition">Create Your Keepsake</a></div>
  </div>
</body></html>`;
        return sendText(res, 404, notFoundHtml, 'text/html; charset=utf-8');
      }

      if (project.expiresAt && new Date(project.expiresAt).getTime() < Date.now()) {
        const expiredHtml = `<!DOCTYPE html>
<html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Keepsake Capsule Concluded — ourpage</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;600&family=Instrument+Serif:italic@0,1&display=swap" rel="stylesheet"><style>body{background-color:#08080a;color:#f4f4f5;font-family:'Plus Jakarta Sans',sans-serif;}</style></head>
<body class="min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-[#121215] border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden">
    <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-400/30 flex items-center justify-center mx-auto text-rose-400 text-2xl">⏳</div>
    <div class="space-y-2">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">30-Day Cloud Window Concluded</div>
      <h1 class="text-2xl font-serif italic text-white tracking-tight">This Keepsake Capsule is Locked</h1>
      <p class="text-xs text-zinc-400 font-sans leading-relaxed">The 30-day live cloud hosting period for &ldquo;<span class="text-zinc-200 font-mono">${escapeHtml(project.slug)}</span>&rdquo; has reached its scheduled expiration date.</p>
    </div>
    <div class="pt-2 flex flex-col gap-2">
      <a href="/editor" class="py-3 px-5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 text-white font-bold text-xs hover:brightness-110 transition shadow-lg shadow-rose-950/40">Renew or Create New Keepsake ($18)</a>
    </div>
  </div>
</body></html>`;
        return sendText(res, 410, expiredHtml, 'text/html; charset=utf-8');
      }

      const templateFile = TEMPLATE_MAP[project.template] || 'loveos.html';
      const templatePath = path.join(ROOT_DIR, templateFile);

      if (!fs.existsSync(templatePath)) {
        return sendText(res, 500, `Template file ${templateFile} not found.`);
      }

      let htmlContent = fs.readFileSync(templatePath, 'utf8');

      const isDraft = project.status === 'draft';
      const cleanProject = {
        id: project.id,
        slug: project.slug,
        template: project.template,
        status: project.status,
        expiresAt: project.expiresAt,
        config: { ...project.configData, isPreviewDraft: isDraft }
      };

      // Server Data Injection into <head>
      const injectionScript = `
  <!-- ourpage Server Hydration -->
  <script>
    window.__SERVER_PROJECT__ = ${JSON.stringify(cleanProject)};
  </script>
`;
      htmlContent = htmlContent.replace('</head>', `${injectionScript}\n</head>`);

      // If draft, inject watermark banner
      if (isDraft) {
        const draftBanner = `
  <!-- Draft Preview Watermark -->
  <div id="studio-draft-pill" class="studio-draft-pill" style="position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(24,24,27,0.92);backdrop-filter:blur(12px);border:1px solid rgba(245,158,11,0.5);color:#fbbf24;padding:6px 14px;border-radius:9999px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;box-shadow:0 10px 25px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;pointer-events:auto;">
    <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#f59e0b;"></span>
    <span>DRAFT PREVIEW &bull; UNPAID</span>
    <a href="${GUMROAD_PRODUCT_URL}?email=${encodeURIComponent(project.email)}&wanted=true&project_slug=${encodeURIComponent(project.slug)}" style="background:#f59e0b;color:#09090b;padding:2px 8px;border-radius:6px;text-decoration:none;font-weight:800;margin-left:4px;">UNLOCK LIVE ($18)</a>
  </div>
`;
        htmlContent = htmlContent.replace(/<body[^>]*>/i, `$&${draftBanner}`);
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': isDraft ? 'no-cache, no-store' : 'public, max-age=60'
      });
      return res.end(htmlContent);
    } catch (err) {
      console.error('[ourpage] Error rendering /v/:slug:', err);
      return sendText(res, 500, 'Error rendering keepsake memory.');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. STATIC FILE SERVING
  // ---------------------------------------------------------------------------
  let safePath = pathname;

  // Domain & URL Security Check for Admin Portal
  if (safePath === '/admin' || safePath === '/admin.html') {
    const adminDomain = process.env.ADMIN_DOMAIN ? process.env.ADMIN_DOMAIN.toLowerCase() : null;
    const host = (req.headers.host || '').split(':')[0].toLowerCase();

    // If an ADMIN_DOMAIN is configured (e.g. admin.ourpage.id), enforce host match
    if (adminDomain && host !== adminDomain && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return sendText(res, 404, 'Not Found');
    }

    // Require valid admin credentials (key in query, header, or cookie)
    if (!authenticateAdmin(req)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="background:#09090b;color:#71717a;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="font-size:3rem;color:#f43f5e;margin:0 0 1rem 0;">404</h1><p>Halaman tidak ditemukan.</p></div></body></html>');
    }

    // Valid admin: set secure session cookie and serve admin portal
    res.setHeader('Set-Cookie', `ourpage_admin=${encodeURIComponent(ADMIN_KEY)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    safePath = '/admin.html';
  } else if (safePath === '/' || safePath === '') {
    // Root URL serves the live interactive LoveOS showcase demo (Viral Funnel)
    safePath = '/loveos.html';
  } else if (safePath === '/editor' || safePath === '/editor.html' || safePath === '/editor-loveos') {
    safePath = '/editor-loveos.html';
  } else if (safePath === '/loveos') {
    safePath = '/loveos.html';
  } else if (safePath === '/loveos') {
    safePath = '/loveos.html';
  }

  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, normalizedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('[ourpage] Stream error:', err);
      if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    });
    return stream.pipe(res);
  }

  return sendText(res, 404, '404 Not Found — ourpage');
}

// Create HTTP Server
const server = http.createServer(handleRequest);

// Standalone Server Mode (Cron checks abandoned drafts every 15 mins)
let cronTimer = null;
if (!process.env.VERCEL) {
  cronTimer = setInterval(() => {
    checkAbandonedDrafts().catch(e => console.warn('[ourpage Cron Timer]', e.message));
  }, 15 * 60 * 1000);
  if (cronTimer.unref) cronTimer.unref();
}

// Start Server if directly executed
if (!process.env.VERCEL && require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`
  ==============================================================
   ourpage LoveOS Keepsake Server Running
   --------------------------------------------------------------
   Main App:        http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}
   LoveOS Editor:   http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/editor-loveos.html
   Template View:   http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/loveos.html
   Admin Portal:    http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/admin.html
   Admin Password:  ${ADMIN_KEY}
   Database Mode:   Strict Supabase Cloud PostgreSQL (loveos_projects)
   WhatsApp Engine: ${process.env.FONNTE_TOKEN ? 'Fonnte Connected' : 'Mock Mode'}
   Abandoned Cron:  Active (Every 15 mins)
  ==============================================================
    `);
  });
}

process.on('SIGTERM', () => {
  if (cronTimer) clearInterval(cronTimer);
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  if (cronTimer) clearInterval(cronTimer);
  server.close(() => process.exit(0));
});

module.exports = (req, res) => handleRequest(req, res);
module.exports.server = server;
