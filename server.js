/**
 * studio.402 Keepsake Engine — Production Backend
 * 
 * Features:
 * - Zero external dependencies (standard http, https, fs, path, url, crypto)
 * - Node.js and Bun runtime compatible
 * - Dynamic /v/:slug keepsake routing with template mapping & instant injection
 * - Static asset & HTML serving (editor.html, admin.html, templates)
 * - Projects database in ./data/projects.json
 * - Slug availability checker (GET /api/check-slug)
 * - Draft saving with 6-digit codes (POST /api/save-draft)
 * - Remote project loader (GET /api/project/:slug)
 * - Gumroad Ping webhook parser & activator (POST /api/gumroad-webhook)
 * - Admin management endpoints (GET /api/admin/projects, POST /api/admin/update-status)
 * - Automatic 30-day / 7-day auto-purge cron (every 6 hours)
 * - Resilient Telegram alerts engine
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');

// =============================================================================
// CONFIGURATION & ENVIRONMENT
// =============================================================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_KEY = process.env.ADMIN_KEY || 'studio402_admin_secret_2026';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(ROOT_DIR, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Template file resolution map
const TEMPLATE_MAP = {
  'spotilove': 'spotilove_ultra_1000_10_studio_edition.html',
  'spotilove_ultra_1000_10_studio_edition.html': 'spotilove_ultra_1000_10_studio_edition.html',
  'vinyl': 'spotilove_ultra_1000_10_studio_edition.html',
  'vinyl.html': 'vinyl.html',
  'netlove': 'netlove_interactive_streaming_bandersnatch_app.html',
  'netlove_interactive_streaming_bandersnatch_app.html': 'netlove_interactive_streaming_bandersnatch_app.html',
  'cinema': 'netlove_interactive_streaming_bandersnatch_app.html',
  'cinema.html': 'cinema.html',
  'lovebox': 'camera.html',
  'lovebox_98_instant_polaroid_camera_retro_game_gadget.html': 'camera.html',
  'camera': 'camera.html',
  'camera.html': 'camera.html',
  'retro': 'camera.html'
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
  'gumroad-webhook', 'webhook', 'index', 'health', 'ping'
]);

// =============================================================================
// DATABASE ENGINE (./data/projects.json)
// =============================================================================
function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function loadProjects() {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[studio.402] Error reading projects.json:', err.message);
    return [];
  }
}

function saveProjects(projects) {
  ensureDataStore();
  try {
    const tempFile = `${PROJECTS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(projects, null, 2), 'utf8');
    fs.renameSync(tempFile, PROJECTS_FILE);
    return true;
  } catch (err) {
    console.error('[studio.402] Error saving projects.json:', err.message);
    return false;
  }
}

// =============================================================================
// TELEGRAM NOTIFICATION SYSTEM
// =============================================================================
async function sendTelegramNotification(title, data = {}) {
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  
  let formattedText = `<b>[studio.402] ${escapeHtml(title)}</b>\n`;
  formattedText += `<code>---------------------------------</code>\n`;
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formattedText += `<b>${escapeHtml(key)}:</b> <code>${escapeHtml(String(value))}</code>\n`;
    }
  }
  formattedText += `<b>Time:</b> <i>${dateStr}</i>`;

  // Always log to server console
  console.log(`\n----------------------------------------`);
  console.log(`[TELEGRAM NOTIFICATION] ${title}`);
  console.log(JSON.stringify(data, null, 2));
  console.log(`----------------------------------------\n`);

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formattedText,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve(res.statusCode === 200);
        });
      });

      req.on('error', (err) => {
        console.warn('[studio.402] Telegram send failed:', err.message);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.warn('[studio.402] Telegram exception:', err.message);
      resolve(false);
    }
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// BACKGROUND 30-DAY / 7-DAY AUTO-PURGE CRON
// =============================================================================
function runAutoPurge() {
  const now = Date.now();
  const projects = loadProjects();
  const initialCount = projects.length;

  const filtered = projects.filter(p => {
    // 1. Delete expired paid projects (30-day / 365-day expiration reached)
    if (p.status === 'paid' && p.expiresAt) {
      const expiry = new Date(p.expiresAt).getTime();
      if (!isNaN(expiry) && expiry < now) {
        return false; // Purge
      }
    }

    // 2. Delete unpaid drafts older than 7 days
    if (p.status === 'draft') {
      const created = new Date(p.createdAt || 0).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (now - created > sevenDaysMs) {
        return false; // Purge
      }
    }

    return true; // Keep active
  });

  const purgedCount = initialCount - filtered.length;
  if (purgedCount > 0) {
    saveProjects(filtered);
    console.log(`[studio.402 AUTO-PURGE] Cleaned up ${purgedCount} expired/abandoned project(s). Active projects: ${filtered.length}`);
  } else {
    console.log(`[studio.402 AUTO-PURGE] No expired projects to purge. Active projects: ${filtered.length}`);
  }
}

// Run purge on startup after 3 seconds, then every 6 hours
setTimeout(runAutoPurge, 3000);
setInterval(runAutoPurge, 6 * 60 * 60 * 1000);

// =============================================================================
// REQUEST HELPER FUNCTIONS
// =============================================================================
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE'
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
    let raw = '';
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB to accommodate compressed Base64 images
    let totalLength = 0;

    req.on('data', chunk => {
      totalLength += chunk.length;
      if (totalLength > MAX_SIZE) {
        reject(new Error('Payload Too Large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        try {
          resolve(querystring.parse(raw));
        } catch (e) {
          reject(new Error('Invalid URL-encoded payload'));
        }
      } else {
        // Fallback: try parsing JSON first, then querystring
        try {
          resolve(JSON.parse(raw));
        } catch (_) {
          resolve(querystring.parse(raw));
        }
      }
    });

    req.on('error', err => reject(err));
  });
}

function authenticateAdmin(req) {
  const headerKey = req.headers['x-admin-key'];
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const queryKey = reqUrl.searchParams.get('admin_key');
    return (headerKey && headerKey === ADMIN_KEY) || (queryKey && queryKey === ADMIN_KEY);
  } catch (_) {
    return headerKey && headerKey === ADMIN_KEY;
  }
}

// =============================================================================
// HTML RENDERERS FOR ERROR & EXPIRED STATES
// =============================================================================
function renderNoticePage(title, message, subtext, actionUrl = '/', actionLabel = 'Back to studio.402') {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — studio.402</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #09090b; color: #f4f4f5; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-6 antialiased">
  <div class="max-w-md w-full text-center space-y-6">
    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 mono text-xs text-zinc-400">
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
      studio.402 / keepsake status
    </div>
    <div class="space-y-3">
      <h1 class="text-3xl font-bold tracking-tight text-white">${escapeHtml(title)}</h1>
      <p class="text-zinc-400 text-sm leading-relaxed">${escapeHtml(message)}</p>
      ${subtext ? `<p class="mono text-xs text-zinc-500">${escapeHtml(subtext)}</p>` : ''}
    </div>
    <div class="pt-4">
      <a href="${actionUrl}" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5">
        <i data-lucide="arrow-left" class="w-4 h-4"></i>
        <span>${escapeHtml(actionLabel)}</span>
      </a>
    </div>
    <div class="pt-8 text-xs text-zinc-600 mono">
      &copy; 2026 studio.402 &bull; curated digital keepsakes
    </div>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>`;
}

// =============================================================================
// MAIN HTTP SERVER
// =============================================================================
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const searchParams = reqUrl.searchParams;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
      'Access-Control-Max-Age': '86400'
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
      return sendJson(res, 400, { available: false, error: 'Slug parameter is required' });
    }

    // Slug format validation: 3-40 chars, lowercase letters, numbers, hyphens
    const slugRegex = /^[a-z0-9-]{3,40}$/;
    if (!slugRegex.test(rawSlug)) {
      return sendJson(res, 200, {
        slug: rawSlug,
        available: false,
        reason: 'Links must be 3-40 characters using only letters, numbers, and hyphens'
      });
    }

    // Check reserved paths
    if (RESERVED_SLUGS.has(rawSlug)) {
      return sendJson(res, 200, {
        slug: rawSlug,
        available: false,
        reason: 'This link name is reserved for system use'
      });
    }

    // Check database
    const projects = loadProjects();
    const existing = projects.find(p => p.slug && p.slug.toLowerCase() === rawSlug);

    if (existing) {
      return sendJson(res, 200, {
        slug: rawSlug,
        available: false,
        reason: 'This custom link is already claimed'
      });
    }

    return sendJson(res, 200, {
      slug: rawSlug,
      available: true
    });
  }

  // POST /api/save-draft
  if (pathname === '/api/save-draft' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const rawSlug = (body.slug || '').trim().toLowerCase();
      const template = (body.template || body.templateId || 'spotilove').toLowerCase();
      const configData = body.configData || body.config || {};

      if (!email || !rawSlug) {
        return sendJson(res, 400, { ok: false, error: 'Both email and slug are required' });
      }

      const projects = loadProjects();

      // Check if project already exists with this slug
      let existingIndex = projects.findIndex(p => p.slug && p.slug.toLowerCase() === rawSlug);
      
      // If claimed by a paid project belonging to someone else, reject
      if (existingIndex !== -1) {
        const existing = projects[existingIndex];
        if (existing.status === 'paid' && existing.email !== email) {
          return sendJson(res, 409, { ok: false, error: 'This custom link is already claimed by another customer' });
        }
      }

      const designCode = body.designCode || `ST-${Math.floor(100000 + Math.random() * 900000)}`;
      const projectId = body.id || (existingIndex !== -1 ? projects[existingIndex].id : `proj_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
      const nowIso = new Date().toISOString();

      const projectRecord = {
        id: projectId,
        slug: rawSlug,
        email: email,
        template: template,
        designCode: designCode,
        configData: configData,
        status: 'draft',
        createdAt: existingIndex !== -1 ? (projects[existingIndex].createdAt || nowIso) : nowIso,
        updatedAt: nowIso,
        expiresAt: null // Drafts are not expired until converted or 7-day purge
      };

      if (existingIndex !== -1) {
        projects[existingIndex] = { ...projects[existingIndex], ...projectRecord };
      } else {
        projects.unshift(projectRecord);
      }

      saveProjects(projects);

      // Trigger Telegram Lead Alert (Async, non-blocking)
      sendTelegramNotification('NEW LEAD SAVED DRAFT', {
        email: email,
        slug: rawSlug,
        template: template,
        designCode: designCode,
        previewUrl: `http://${req.headers.host || 'localhost:3000'}/v/${rawSlug}`
      }).catch(err => console.warn('Telegram notice error:', err.message));

      return sendJson(res, 200, {
        ok: true,
        id: projectId,
        slug: rawSlug,
        designCode: designCode,
        status: 'draft',
        previewUrl: `/v/${rawSlug}`
      });
    } catch (err) {
      console.error('[studio.402] save-draft error:', err);
      return sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
    }
  }

  // GET /api/project/:slug (or GET /api/project?id=...)
  if ((pathname.startsWith('/api/project/') || pathname === '/api/project') && method === 'GET') {
    let slugParam = '';
    if (pathname.startsWith('/api/project/')) {
      slugParam = decodeURIComponent(pathname.substring('/api/project/'.length)).trim();
    } else {
      slugParam = (searchParams.get('id') || searchParams.get('slug') || '').trim();
    }

    if (!slugParam) {
      return sendJson(res, 400, { ok: false, error: 'Project identifier or slug is required' });
    }

    const projects = loadProjects();
    const project = projects.find(p => 
      (p.slug && p.slug.toLowerCase() === slugParam.toLowerCase()) ||
      p.id === slugParam ||
      (p.designCode && p.designCode.toUpperCase() === slugParam.toUpperCase())
    );

    if (!project) {
      return sendJson(res, 404, { ok: false, error: 'Keepsake not found' });
    }

    // Check expiration
    if (project.expiresAt) {
      const expiry = new Date(project.expiresAt).getTime();
      if (!isNaN(expiry) && expiry < Date.now()) {
        return sendJson(res, 410, {
          ok: false,
          error: 'Keepsake has expired',
          expired: true,
          expiresAt: project.expiresAt
        });
      }
    }

    const isPreviewDraft = project.status === 'draft';
    const responsePayload = {
      ok: true,
      id: project.id,
      slug: project.slug,
      template: project.template,
      designCode: project.designCode,
      status: project.status,
      isPreviewDraft: isPreviewDraft,
      createdAt: project.createdAt,
      expiresAt: project.expiresAt,
      // Provide both .config and .configData to ensure universal client compatibility
      config: {
        ...(project.configData || {}),
        isPreviewDraft: isPreviewDraft
      },
      configData: {
        ...(project.configData || {}),
        isPreviewDraft: isPreviewDraft
      }
    };

    return sendJson(res, 200, responsePayload);
  }

  // POST /api/gumroad-webhook
  if (pathname === '/api/gumroad-webhook' && method === 'POST') {
    try {
      const body = await parseBody(req);
      
      // Extract purchaser email
      const buyerEmail = (body.email || body.purchaser_email || body.buyer_email || '').trim().toLowerCase();
      
      // Extract url_params (Gumroad can send this as an object, a string, or nested keys)
      let customSlug = '';
      if (body.url_params) {
        if (typeof body.url_params === 'object') {
          customSlug = body.url_params.custom_slug || body.url_params.slug || '';
        } else if (typeof body.url_params === 'string') {
          try {
            const parsed = JSON.parse(body.url_params);
            customSlug = parsed.custom_slug || parsed.slug || '';
          } catch (_) {
            const parsed = querystring.parse(body.url_params);
            customSlug = parsed.custom_slug || parsed.slug || '';
          }
        }
      }
      if (!customSlug) {
        customSlug = body.custom_slug || body.slug || '';
      }
      customSlug = String(customSlug).trim().toLowerCase();

      // Extract price paid
      let priceRaw = body.price || 0;
      let priceDisplay = '';
      const numPrice = Number(priceRaw);
      if (!isNaN(numPrice)) {
        // Gumroad sends price in cents (e.g. 1900 = $19.00)
        priceDisplay = numPrice >= 100 ? `$${(numPrice / 100).toFixed(2)}` : `$${numPrice}`;
      } else {
        priceDisplay = String(priceRaw);
      }

      console.log(`[studio.402 GUMROAD WEBHOOK] Ping received for email: "${buyerEmail}", slug: "${customSlug}", price: "${priceDisplay}"`);

      const projects = loadProjects();
      let matchedIndex = -1;

      // 1. Try matching by slug
      if (customSlug) {
        matchedIndex = projects.findIndex(p => p.slug && p.slug.toLowerCase() === customSlug);
      }

      // 2. Fallback: match by buyer email (most recent draft)
      if (matchedIndex === -1 && buyerEmail) {
        matchedIndex = projects.findIndex(p => p.email && p.email.toLowerCase() === buyerEmail && p.status === 'draft');
      }

      // 3. Fallback: match any project by email
      if (matchedIndex === -1 && buyerEmail) {
        matchedIndex = projects.findIndex(p => p.email && p.email.toLowerCase() === buyerEmail);
      }

      if (matchedIndex === -1) {
        console.warn(`[studio.402 GUMROAD] No matching project draft found for email: ${buyerEmail}, slug: ${customSlug}`);
        sendTelegramNotification('GUMROAD SALE - UNMATCHED DRAFT', {
          email: buyerEmail,
          slug: customSlug || 'NONE_PROVIDED',
          price: priceDisplay,
          note: 'Customer paid on Gumroad but draft was not found. Please review.'
        }).catch(() => {});

        return sendJson(res, 200, {
          ok: true,
          warning: 'No matching draft found; recorded alert for administrator review'
        });
      }

      const targetProject = projects[matchedIndex];
      const now = Date.now();
      
      // Determine subscription duration:
      // Bundle / Upsell Tier (price >= $35 or product mentions bundle/year/annual) -> 365 Days
      // Standard Keepsake Tier -> 30 Days
      const productName = String(body.product_name || body.variants_and_quantity || '').toLowerCase();
      const isBundleTier = numPrice >= 3500 || productName.includes('bundle') || productName.includes('365') || productName.includes('annual') || productName.includes('forever');
      const durationDays = isBundleTier ? 365 : 30;
      const expiresAtIso = new Date(now + durationDays * 24 * 60 * 60 * 1000).toISOString();

      targetProject.status = 'paid';
      targetProject.expiresAt = expiresAtIso;
      targetProject.paidAt = new Date().toISOString();
      targetProject.paidPrice = priceDisplay;
      targetProject.gumroadSaleId = body.sale_id || body.order_number || null;

      projects[matchedIndex] = targetProject;
      saveProjects(projects);

      console.log(`[studio.402 GUMROAD] Project "${targetProject.slug}" activated! Status: paid, Expires: ${expiresAtIso}`);

      // Send Instant Telegram Sale Alert
      sendTelegramNotification('NEW SALE PAID & LIVE!', {
        email: targetProject.email,
        slug: targetProject.slug,
        template: targetProject.template,
        price: priceDisplay,
        tier: isBundleTier ? '365-Day Annual Memory' : '30-Day Keepsake',
        liveUrl: `http://${req.headers.host || 'localhost:3000'}/v/${targetProject.slug}`,
        expiresAt: expiresAtIso
      }).catch(err => console.warn('Telegram notice error:', err.message));

      return sendJson(res, 200, {
        ok: true,
        message: 'Keepsake successfully activated and live',
        slug: targetProject.slug,
        status: 'paid',
        expiresAt: expiresAtIso
      });
    } catch (err) {
      console.error('[studio.402 GUMROAD WEBHOOK] Error:', err);
      return sendJson(res, 500, { ok: false, error: err.message || 'Webhook processing failed' });
    }
  }

  // GET /api/admin/projects (Protected)
  if (pathname === '/api/admin/projects' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid x-admin-key' });
    }

    const projects = loadProjects();
    const now = Date.now();

    const stats = {
      total: projects.length,
      paid: projects.filter(p => p.status === 'paid' && (!p.expiresAt || new Date(p.expiresAt).getTime() > now)).length,
      drafts: projects.filter(p => p.status === 'draft').length,
      expired: projects.filter(p => p.expiresAt && new Date(p.expiresAt).getTime() <= now).length
    };

    return sendJson(res, 200, {
      ok: true,
      stats: stats,
      projects: projects
    });
  }

  // POST /api/admin/update-status (Protected)
  if (pathname === '/api/admin/update-status' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid x-admin-key' });
    }

    try {
      const body = await parseBody(req);
      const identifier = (body.slug || body.id || '').trim().toLowerCase();

      if (!identifier) {
        return sendJson(res, 400, { ok: false, error: 'Identifier (slug or id) required' });
      }

      const projects = loadProjects();
      const idx = projects.findIndex(p => 
        (p.slug && p.slug.toLowerCase() === identifier) ||
        p.id === identifier
      );

      if (idx === -1) {
        return sendJson(res, 404, { ok: false, error: 'Project not found' });
      }

      const target = projects[idx];

      // Update status
      if (body.status && ['draft', 'paid', 'archived'].includes(body.status)) {
        target.status = body.status;
      }

      // Extend expiration by days
      if (typeof body.extendDays === 'number') {
        const baseTime = target.expiresAt ? Math.max(Date.now(), new Date(target.expiresAt).getTime()) : Date.now();
        target.expiresAt = new Date(baseTime + body.extendDays * 86400000).toISOString();
      }

      // Explicit expiresAt override
      if (body.expiresAt) {
        target.expiresAt = new Date(body.expiresAt).toISOString();
      }

      target.updatedAt = new Date().toISOString();
      projects[idx] = target;
      saveProjects(projects);

      return sendJson(res, 200, {
        ok: true,
        project: target
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. DYNAMIC SLUG ROUTING: /v/:slug
  // ---------------------------------------------------------------------------
  if (pathname.startsWith('/v/')) {
    const slug = pathname.substring('/v/'.length).split('/')[0].split('?')[0].trim().toLowerCase();

    if (!slug) {
      res.writeHead(302, { 'Location': '/editor.html' });
      return res.end();
    }

    const projects = loadProjects();
    const project = projects.find(p => p.slug && p.slug.toLowerCase() === slug);

    if (!project) {
      const html = renderNoticePage(
        'Keepsake Not Found',
        `The personalized keepsake link "/v/${escapeHtml(slug)}" does not exist or has been removed.`,
        'Check the link sent by your partner or create a new memory capsule in the studio editor.',
        '/editor.html',
        'Open Studio Editor'
      );
      return sendText(res, 404, html, 'text/html; charset=utf-8');
    }

    // Check if expired
    if (project.expiresAt) {
      const expiry = new Date(project.expiresAt).getTime();
      if (!isNaN(expiry) && expiry < Date.now()) {
        const expiryDateFormatted = new Date(project.expiresAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        const html = renderNoticePage(
          'Keepsake Expired',
          `This memory page reached its active retention limit on ${expiryDateFormatted}.`,
          'To renew or restore this memory capsule, contact studio.402 support.',
          'mailto:support@studio402.com',
          'Contact Support to Renew'
        );
        return sendText(res, 410, html, 'text/html; charset=utf-8');
      }
    }

    // Locate Template File
    const templateKey = (project.template || 'spotilove').toLowerCase();
    const templateFileName = TEMPLATE_MAP[templateKey] || 'spotilove_ultra_1000_10_studio_edition.html';
    const templateFilePath = path.join(ROOT_DIR, templateFileName);

    if (!fs.existsSync(templateFilePath)) {
      return sendText(res, 500, `Template file "${templateFileName}" not found on server.`);
    }

    try {
      let htmlContent = fs.readFileSync(templateFilePath, 'utf8');

      // Inject server-side data for instantaneous client loading (0ms latency)
      const isDraft = project.status === 'draft';
      const injectionScript = `
  <!-- studio.402 Server-Injected Keepsake Payload -->
  <script>
    window.__PROJECT_SLUG__ = ${JSON.stringify(project.slug)};
    window.__PROJECT_STATUS__ = ${JSON.stringify(project.status)};
    window.__SERVER_PROJECT__ = ${JSON.stringify(project.configData || {})};
  </script>
`;
      // Optional draft watermark pill
      const draftWatermark = isDraft ? `
  <div id="studio-draft-pill" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(24,24,27,0.92);border:1px solid rgba(245,158,11,0.5);color:#f59e0b;padding:6px 14px;border-radius:9999px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.04em;display:flex;align-items:center;gap:8px;box-shadow:0 10px 25px rgba(0,0,0,0.6);backdrop-filter:blur(8px);pointer-events:auto;">
    <span style="width:6px;height:6px;border-radius:9999px;background:#f59e0b;animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></span>
    <span>DRAFT PREVIEW</span>
    <span style="color:#52525b;">&bull;</span>
    <a href="/editor.html" style="color:#e4e4e7;text-decoration:underline;">Finish &amp; Publish</a>
  </div>
` : '';

      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${injectionScript}</head>`);
      } else {
        htmlContent = injectionScript + htmlContent;
      }

      if (isDraft && htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace(/(<body[^>]*>)/i, `$1${draftWatermark}`);
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': isDraft ? 'no-cache, no-store' : 'public, max-age=60'
      });
      return res.end(htmlContent);
    } catch (err) {
      console.error('[studio.402] Error serving /v/:slug template:', err);
      return sendText(res, 500, 'Error rendering keepsake memory.');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. STATIC FILE SERVING
  // ---------------------------------------------------------------------------
  
  // Normalize path and routes
  let safePath = pathname;
  if (safePath === '/' || safePath === '') {
    safePath = fs.existsSync(path.join(ROOT_DIR, 'index.html')) ? '/index.html' : '/editor.html';
  } else if (safePath === '/editor') {
    safePath = '/editor.html';
  } else if (safePath === '/admin') {
    safePath = '/admin.html';
  } else if (safePath === '/spotilove' || safePath === '/vinyl') {
    safePath = '/spotilove_ultra_1000_10_studio_edition.html';
  } else if (safePath === '/netlove' || safePath === '/cinema') {
    safePath = '/netlove_interactive_streaming_bandersnatch_app.html';
  } else if (safePath === '/lovebox' || safePath === '/camera') {
    safePath = '/lovebox_98_instant_polaroid_camera_retro_game_gadget.html';
  }

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, normalizedPath);

  // Ensure requested file stays inside ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  // Check if file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('[studio.402] Stream error:', err);
      if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    });
    return stream.pipe(res);
  }

  // Fallback 404
  return sendText(res, 404, '404 Not Found — studio.402');
});

// Start Server
ensureDataStore();
if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`
  ==============================================================
   studio.402 Keepsake Server is Running
   --------------------------------------------------------------
   URL:             http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}
   Editor:          http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/editor.html
   Admin Portal:    http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/admin.html
   Admin Key:       ${ADMIN_KEY}
   Data Directory:  ${DATA_DIR}
   Telegram Alerts: ${TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? 'CONNECTED (Active)' : 'MOCK CONSOLE LOG (Configure ENV)'}
   Auto-Purge Cron: Active (Every 6 Hours)
  ==============================================================
    `);
  });
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[studio.402] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[studio.402] SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = server;
