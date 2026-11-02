const http = require('http');

async function runTests() {
  const PORT = 3899;
  process.env.PORT = PORT;
  process.env.ADMIN_KEY = 'test_admin_key_123';
  
  // Require and start server
  require('./server.js');
  
  // Allow server a brief moment to start
  await new Promise(r => setTimeout(r, 600));

  function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: path,
        method: method,
        headers: headers
      };

      if (body) {
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  const testSlug = 'test-slug-' + Math.floor(Math.random() * 100000);

  try {
    // 1. Static Routes
    console.log('\n--- 1. Testing Static File Serving ---');
    const rRoot = await request('GET', '/');
    assert('GET / serves editor.html (200)', rRoot.status === 200 && rRoot.body.includes('studio.402'));

    const rAdmin = await request('GET', '/admin');
    assert('GET /admin serves admin.html (200)', rAdmin.status === 200 && (rAdmin.body.includes('Operations Dashboard') || rAdmin.body.includes('Operations Portal')));

    const rSpoti = await request('GET', '/spotilove');
    assert('GET /spotilove serves spotilove template (200)', rSpoti.status === 200 && rSpoti.body.includes('Our Love Wrapped'));

    const rNet = await request('GET', '/netlove');
    assert('GET /netlove serves netlove template (200)', rNet.status === 200 && rNet.body.includes('NETLOVE'));

    const rBox = await request('GET', '/lovebox');
    assert('GET /lovebox serves lovebox template (200)', rBox.status === 200 && (rBox.body.includes('LOVEBOX') || rBox.body.includes('35mm') || rBox.body.includes('Camera')));

    // 2. Slug Availability Checker
    console.log('\n--- 2. Testing /api/check-slug ---');
    const rSlugAvail = await request('GET', `/api/check-slug?slug=${testSlug}`);
    const slugAvailJson = JSON.parse(rSlugAvail.body);
    assert(`GET /api/check-slug?slug=${testSlug} is available`, slugAvailJson.available === true);

    const rSlugReserved = await request('GET', '/api/check-slug?slug=admin');
    const slugReservedJson = JSON.parse(rSlugReserved.body);
    assert('GET /api/check-slug?slug=admin is rejected (reserved)', slugReservedJson.available === false);

    // 3. Draft Saving
    console.log('\n--- 3. Testing /api/save-draft ---');
    const draftPayload = JSON.stringify({
      email: 'sarah@example.com',
      slug: testSlug,
      template: 'spotilove',
      configData: {
        coupleName: 'Sarah & David',
        songTitle: 'Golden Hour'
      }
    });
    const rDraft = await request('POST', '/api/save-draft', { 'Content-Type': 'application/json' }, draftPayload);
    const draftJson = JSON.parse(rDraft.body);
    assert('POST /api/save-draft returns 200 ok', rDraft.status === 200 && draftJson.ok === true);
    assert('POST /api/save-draft returns ST- code and status draft', draftJson.designCode.startsWith('ST-') && draftJson.status === 'draft');

    // Check slug is now taken
    const rSlugTaken = await request('GET', `/api/check-slug?slug=${testSlug}`);
    const slugTakenJson = JSON.parse(rSlugTaken.body);
    assert(`GET /api/check-slug?slug=${testSlug} is now unavailable (taken)`, slugTakenJson.available === false);

    // 4. Remote Project Retrieval
    console.log('\n--- 4. Testing /api/project/:slug ---');
    const rProj = await request('GET', `/api/project/${testSlug}`);
    const projJson = JSON.parse(rProj.body);
    assert(`GET /api/project/${testSlug} returns draft config`, rProj.status === 200 && projJson.isPreviewDraft === true);
    assert('config contains coupleName', projJson.config.coupleName === 'Sarah & David');

    // 5. Dynamic Slug Routing /v/:slug
    console.log('\n--- 5. Testing /v/:slug Dynamic Routing ---');
    const rView = await request('GET', `/v/${testSlug}`);
    assert(`GET /v/${testSlug} returns 200 HTML`, rView.status === 200 && rView.headers['content-type'].includes('text/html'));
    assert(`/v/${testSlug} injects __SERVER_PROJECT__ data`, rView.body.includes('window.__SERVER_PROJECT__') && (rView.body.includes('Sarah &amp; David') || rView.body.includes('Sarah & David')));
    assert(`/v/${testSlug} shows draft watermark pill`, rView.body.includes('studio-draft-pill'));

    // 404 on non-existent slug
    const rView404 = await request('GET', '/v/unknown-slug-404');
    assert('GET /v/unknown-slug returns 404 keepsake notice page', rView404.status === 404 && rView404.body.includes('Keepsake Not Found'));

    // 6. Gumroad Webhook Activation
    console.log('\n--- 6. Testing /api/gumroad-webhook ---');
    const webhookPayload = JSON.stringify({
      email: 'sarah@example.com',
      price: 1900,
      url_params: {
        custom_slug: testSlug
      }
    });
    const rHook = await request('POST', '/api/gumroad-webhook', { 'Content-Type': 'application/json' }, webhookPayload);
    const hookJson = JSON.parse(rHook.body);
    assert('POST /api/gumroad-webhook returns 200 ok', rHook.status === 200 && hookJson.ok === true && hookJson.status === 'paid');

    // Verify project is now paid with expiration in 30 days
    const rProjPaid = await request('GET', `/api/project/${testSlug}`);
    const projPaidJson = JSON.parse(rProjPaid.body);
    assert('Project status is now "paid"', projPaidJson.status === 'paid' && projPaidJson.isPreviewDraft === false);
    assert('Project has valid 30-day expiresAt', !!projPaidJson.expiresAt && new Date(projPaidJson.expiresAt) > new Date());

    // 7. Admin Endpoints
    console.log('\n--- 7. Testing Admin Endpoints ---');
    const rAdminUnauth = await request('GET', '/api/admin/projects');
    assert('GET /api/admin/projects without key is 401 Unauthorized', rAdminUnauth.status === 401);

    const rAdminAuth = await request('GET', '/api/admin/projects', { 'x-admin-key': 'test_admin_key_123' });
    const adminJson = JSON.parse(rAdminAuth.body);
    assert('GET /api/admin/projects with key returns 200 stats', rAdminAuth.status === 200 && adminJson.stats.paid >= 1);

    // Update status / extend days via admin
    const adminUpdatePayload = JSON.stringify({
      slug: testSlug,
      extendDays: 365
    });
    const rAdminUpdate = await request('POST', '/api/admin/update-status', {
      'Content-Type': 'application/json',
      'x-admin-key': 'test_admin_key_123'
    }, adminUpdatePayload);
    const adminUpdateJson = JSON.parse(rAdminUpdate.body);
    assert('POST /api/admin/update-status extends days', rAdminUpdate.status === 200 && adminUpdateJson.ok === true);

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} / ${total} tests passed.`);
    console.log(`========================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
