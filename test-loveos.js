/**
 * End-to-End Test Suite for OurPage LoveOS
 */

const http = require('http');
const assert = require('assert');
const serverApp = require('./server.js');
const db = require('./db.js');

const TEST_PORT = 3457;
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
        try { json = JSON.parse(data); } catch (_) {}
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
  console.log('🚀 Starting OurPage LoveOS End-to-End Test Suite...\n');

  const testServer = http.createServer(serverApp);
  await new Promise(resolve => testServer.listen(TEST_PORT, '127.0.0.1', resolve));

  const testSlug = `ourpage-test-${Date.now().toString().slice(-5)}`;
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
    assert.ok(rootRes.data.includes('OurPage'), 'Root should serve OurPage editor');

    const editorRes = await makeRequest('GET', '/editor-loveos.html');
    assert.strictEqual(editorRes.status, 200);
    assert.ok(editorRes.data.includes('OurPage'), 'Direct editor URL should serve OurPage editor');
    console.log('✓ Static routes for OurPage editor verified.');

    // -------------------------------------------------------------------------
    // TEST 3: Admin API with new password '577811Bjs!'
    // -------------------------------------------------------------------------
    console.log('\nTest 3: GET /api/admin/projects with new password "577811Bjs!"');
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

    console.log('\n======================================================');
    console.log('🎉 ALL OURPAGE REVAMP TESTS PASSED PERFECTLY!');
    console.log('======================================================\n');
  } finally {
    testServer.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
