/**
 * Comprehensive End-to-End Test Suite for OurPage LoveOS
 */

const http = require('http');
const assert = require('assert');
const serverApp = require('./server.js');
const db = require('./db.js');

const TEST_PORT = 3458;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (body) {
      reqBody = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting OurPage LoveOS Comprehensive Test Suite...\n');

  const testServer = http.createServer(serverApp);
  await new Promise(resolve => testServer.listen(TEST_PORT, '127.0.0.1', resolve));

  const testSlug = `test-e2e-${Date.now().toString().slice(-6)}`;
  const testEmail = `test-${Date.now()}@example.com`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Check Slug Availability
    // -------------------------------------------------------------------------
    console.log('Test 1: GET /api/check-slug for new slug');
    const slugRes = await makeRequest('GET', `/api/check-slug?slug=${testSlug}`);
    assert.strictEqual(slugRes.status, 200);
    assert.strictEqual(slugRes.json.available, true);
    console.log('✓ Slug check passed.');

    // -------------------------------------------------------------------------
    // TEST 2: Static routing for root and editor
    // -------------------------------------------------------------------------
    console.log('\nTest 2: Static routing for root and editor');
    const rootRes = await makeRequest('GET', '/');
    assert.strictEqual(rootRes.status, 200);
    assert.ok(rootRes.data.includes('ourpage') || rootRes.data.includes('OurPage') || rootRes.data.includes('LoveOS'), 'Root should serve LoveOS');

    const editorRes = await makeRequest('GET', '/editor-loveos.html');
    assert.strictEqual(editorRes.status, 200);
    assert.ok(editorRes.data.includes('step-1'), 'Editor should include 5-step wizard');
    assert.ok(editorRes.data.includes('step-5'), 'Editor should include Step 5 publish');
    console.log('✓ Static routes for OurPage editor verified.');

    // -------------------------------------------------------------------------
    // TEST 3: Admin API with password '577811Bjs!'
    // -------------------------------------------------------------------------
    console.log('\nTest 3: GET /api/admin/projects with password "577811Bjs!"');
    const adminRes = await makeRequest('GET', '/api/admin/projects', null, {
      'x-admin-key': '577811Bjs!'
    });
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.json.ok, true);
    assert.ok(Array.isArray(adminRes.json.projects));
    console.log(`✓ Admin API verified with password 577811Bjs!`);

    // Wrong password test
    const wrongAuthRes = await makeRequest('GET', '/api/admin/projects', null, {
      'x-admin-key': 'wrong_password'
    });
    assert.strictEqual(wrongAuthRes.status, 401);
    console.log('✓ Admin API security verified (rejects invalid password).');

    // -------------------------------------------------------------------------
    // TEST 4: Built-in Audio Files & Gift Card Module
    // -------------------------------------------------------------------------
    console.log('\nTest 4: Static audio presets & gift card generator module');
    const song1Res = await makeRequest('GET', '/audio/song1.mp3');
    assert.strictEqual(song1Res.status, 200);
    assert.ok(song1Res.data.length > 500, 'Audio file should have content');

    const giftcardRes = await makeRequest('GET', '/loveos-giftcard.js');
    assert.strictEqual(giftcardRes.status, 200);
    assert.ok(giftcardRes.data.includes('LoveOSGiftCard'), 'Gift card module should export LoveOSGiftCard');
    console.log('✓ Audio tracks and giftcard module verified.');

    // -------------------------------------------------------------------------
    // TEST 5: Verify Features in loveos.html
    // -------------------------------------------------------------------------
    console.log('\nTest 5: Verify Features in loveos.html');
    const loveosRes = await makeRequest('GET', '/loveos.html');
    assert.strictEqual(loveosRes.status, 200);
    assert.ok(loveosRes.data.includes('COUPLE_DATA'), 'Must include COUPLE_DATA');
    assert.ok(loveosRes.data.includes('scratch-canvas'), 'Must include Scratch-to-Reveal Voucher');
    assert.ok(loveosRes.data.includes('renderLoveOS'), 'Must include renderLoveOS function');
    console.log('✓ loveos.html verified with new LoveOS template architecture.');

    // -------------------------------------------------------------------------
    // TEST 6: Save Draft, Verify 30-Day Expiry & VIP Re-Edit Token
    // -------------------------------------------------------------------------
    console.log('\nTest 6: POST /api/save-draft to create a live draft with VIP edit token');
    const draftPayload = {
      id: `draft-${Date.now()}`,
      slug: testSlug,
      email: testEmail,
      template: 'loveos',
      configData: {
        partnerName: 'Emma',
        creatorName: 'Lucas',
        anniversaryDate: '2024-10-14',
        heroNote: 'For Lucas & Emma'
      }
    };

    const saveDraftRes = await makeRequest('POST', '/api/save-draft', draftPayload);
    assert.strictEqual(saveDraftRes.status, 200);
    assert.strictEqual(saveDraftRes.json.ok, true);
    assert.ok(saveDraftRes.json.editToken, 'Draft must return secret editToken');
    assert.ok(saveDraftRes.json.expiresAt, 'Draft must return 30-day expiresAt');
    assert.ok(saveDraftRes.json.publicUrl.includes('/u/'), 'Public URL must use /u/ format');
    assert.ok(saveDraftRes.json.reeditUrl.includes('token='), 'Re-edit URL must include secret token');
    const editToken = saveDraftRes.json.editToken;
    console.log(`✓ Draft created successfully! editToken: ${editToken.slice(0, 8)}..., expiresAt: ${saveDraftRes.json.expiresAt}`);

    // -------------------------------------------------------------------------
    // TEST 7: VIP Re-Edit Verification & Instant Live Update
    // -------------------------------------------------------------------------
    console.log('\nTest 7: VIP Re-Edit authentication and live update');
    // 7a. Get project via reedit
    const reeditGetRes = await makeRequest('GET', `/api/project/reedit?slug=${testSlug}&token=${editToken}`);
    assert.strictEqual(reeditGetRes.status, 200);
    assert.strictEqual(reeditGetRes.json.ok, true);
    assert.strictEqual(reeditGetRes.json.slug, testSlug);
    assert.strictEqual(reeditGetRes.json.configData.partnerName, 'Emma');
    console.log('✓ VIP GET authentication succeeded.');

    // 7b. Invalid token check
    const badTokenRes = await makeRequest('GET', `/api/project/reedit?slug=${testSlug}&token=invalid_token_123`);
    assert.strictEqual(badTokenRes.status, 401);
    console.log('✓ VIP unauthorized rejection verified.');

    // 7c. Post live changes without payment
    const reeditUpdateRes = await makeRequest('POST', '/api/project/reedit', {
      slug: testSlug,
      token: editToken,
      configData: {
        partnerName: 'Emma Updated',
        creatorName: 'Lucas',
        anniversaryDate: '2024-10-14'
      }
    });
    assert.strictEqual(reeditUpdateRes.status, 200);
    assert.strictEqual(reeditUpdateRes.json.ok, true);
    console.log('✓ VIP live update succeeded without repurchasing.');

    // -------------------------------------------------------------------------
    // TEST 8: Verify Live Rendering via /u/:slug
    // -------------------------------------------------------------------------
    console.log('\nTest 8: GET /u/:slug live rendering');
    const publicRenderRes = await makeRequest('GET', `/u/${testSlug}`);
    assert.strictEqual(publicRenderRes.status, 200);
    assert.ok(publicRenderRes.data.includes('Emma Updated'), 'Rendered HTML should reflect live updated data');
    console.log('✓ /u/:slug successfully rendered live updated keepsake.');

    console.log('\n======================================================');
    console.log('🎉 ALL OURPAGE UPGRADE & E2E TESTS PASSED PERFECTLY!');
    console.log('======================================================\n');
  } finally {
    testServer.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
