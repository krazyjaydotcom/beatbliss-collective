// Run with node scripts/admin-regression-tests.cjs. Fixtures never contact a provider/database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, requireMock = require) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', output)(exports, requireMock);
  return exports;
}
const match = load('src/lib/purchase-license-match.ts').matchPurchaseLicense;
const license = { id: 'new', beat_id: 'a', stripe_session_id: 'new-payment' };
assert.equal(match({ beat_id: 'a', stripe_session_id: 'old-payment' }, [license]), null);
assert.equal(match(license, [license]), license);
assert.equal(match({ beat_id: 'b', stripe_session_id: 'new-payment' }, [license]), null);
assert.equal(match({ beat_id: null, stripe_session_id: 'new-payment' }, [license]), null);
assert.equal(match({ beat_id: 'a', stripe_session_id: null }, [license]), null);
assert.equal(match(license, [license, { ...license, id: 'duplicate' }]), null);
const factory = () => ({ middleware() { return this; }, inputValidator(v) { this.validate = v; return this; }, handler(h) { return { h, validate: this.validate }; } });
let duplicate = false, lookupError = false, networkCalls = 0, payload;
const db = {
  rpc: async () => ({ data: true, error: null }),
  storage: { from: () => ({ download: async () => ({ data: new Blob(['attachment']), error: null }) }) },
  from(table) {
    const q = {
      select() { return this; }, ilike() { return this; }, not() { return this; }, neq() { return this; },
      limit: async () => ({ data: table === 'lease_orders' ? [{ id: 'fixture' }] : [], error: lookupError ? { message: 'fixture failure' } : null }),
      insert: async () => ({ error: duplicate ? { code: '23505' } : null }),
      update() { return this; }, eq: async () => ({ error: null }),
    };
    return q;
  },
};
const bird = load('src/lib/bird.functions.ts', (name) => {
  if (name === '@tanstack/react-start') return { createServerFn: factory };
  if (name.includes('auth-middleware')) return { requireSupabaseAuth: {} };
  if (name.includes('client.server')) return { supabaseAdmin: db };
  return require(name);
});
const context = { supabase: db, userId: 'fixture-admin' };
async function run() {
  delete process.env.BIRD_API_KEY; delete process.env.BIRD_FROM_EMAIL; delete process.env.BIRD_REGION;
  const missingStatus = await bird.adminBirdStatus.h({ context });
  assert.equal(missingStatus.configured, false);
  assert.deepEqual(missingStatus.missing, ['BIRD_API_KEY', 'BIRD_FROM_EMAIL', 'BIRD_REGION']);
  process.env.BIRD_API_KEY = 'secret-fixture'; process.env.BIRD_FROM_EMAIL = 'invalid'; process.env.BIRD_REGION = 'wrong';
  const invalidStatus = await bird.adminBirdStatus.h({ context });
  assert.equal(invalidStatus.configured, false);
  assert.equal(invalidStatus.issues.length, 2);
  assert.ok(!JSON.stringify(invalidStatus).includes('secret-fixture'));
  assert.equal(networkCalls, 0, 'settings checks must not send emails or call Bird');
  await assert.rejects(() => bird.adminBirdStatus.h({ context: { supabase: { rpc: async () => ({ data: false }) } } }), /Forbidden/);
  assert.throws(() => bird.adminBirdSend.validate({ confirmed: false }));
  process.env.BIRD_API_KEY = 'fixture'; process.env.BIRD_FROM_EMAIL = 'sender@example.com'; process.env.BIRD_REGION = 'us1';
  const data = { requestId: '11111111-1111-4111-8111-111111111111', recipients: ['a@example.com', 'b@example.com'], category: 'transactional', consentConfirmed: false, confirmed: true, subject: 'Fixture', body: 'Fixture only', files: [] };
  assert.match((await bird.adminBirdSend.h({ data, context })).reason, /marketing protections/);
  data.category = 'marketing';
  assert.match((await bird.adminBirdSend.h({ data, context })).reason, /permission/);
  lookupError = true;
  await assert.rejects(() => bird.adminBirdReview.h({ data: { recipients: data.recipients }, context }), /nothing was sent/);
  lookupError = false; data.consentConfirmed = true;
  global.fetch = async (url, init) => {
    networkCalls++; payload = JSON.parse(init.body);
    assert.equal(init.headers['Idempotency-Key'], data.requestId);
    assert.match(url, /\/batches$/);
    return { ok: true, json: async () => ({ data: [{ id: 'one', status: 'queued' }, { id: 'two', status: 'queued' }] }) };
  };
  assert.equal((await bird.adminBirdSend.h({ data, context })).ok, true);
  assert.equal(networkCalls, 1);
  assert.deepEqual(payload.messages.map(m => m.to), [['a@example.com'], ['b@example.com']]);
  assert.ok(payload.messages.every(m => m.category === 'marketing'));
  const beforeSizeCheck = networkCalls;
  const originalDownload = db.storage.from;
  db.storage.from = () => ({ download: async () => ({ data: new Blob([new Uint8Array(8 * 1024 * 1024)]), error: null }) });
  const large = { ...data, files: [{ path: 'uploads/fixture.pdf', name: 'fixture.pdf' }] };
  assert.match((await bird.adminBirdSend.h({ data: large, context })).reason, /encoded request limit/);
  assert.equal(networkCalls, beforeSizeCheck);
  db.storage.from = originalDownload;
  duplicate = true;
  assert.match((await bird.adminBirdSend.h({ data, context })).reason, /already recorded/);
  assert.equal(networkCalls, 1, 'duplicate attempt must never reach Bird');
  console.log('PASS: exact licenses, admin auth, configuration, confirmation, consent, lookup failures, private bulk recipients and duplicate-send protection. All services mocked.');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
