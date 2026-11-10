import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const origin = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('Run these checks against a local server only.');
const live = process.argv.includes('--live');
const stamp = randomUUID().slice(0, 8);
let passed = 0; const createdIds = []; const createdEmails = [];
const password = randomUUID() + 'Aa1!';
async function request(path, body, cookie = '', extra = {}) {
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(80000) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 150) }; }
    return { status: response.status, data, cookie: response.headers.getSetCookie().map(c => c.split(';')[0]).join('; '), rawCookie: response.headers.get('set-cookie') || '' };
}
function check(condition, label) { assert.ok(condition, label); passed++; console.log('PASS ' + label); }
function ok(result) { assert.ok(result.status < 300, JSON.stringify({ status: result.status, error: result.data.error })); return result.data; }
async function register(name, role) {
    const email = `qa-${role}-${name.toLowerCase()}-${stamp}@pact.local`; createdEmails.push(email);
    const response = await request('/api/auth', { action: 'register', name: `QA ${name}`, email, password, role, ...(role === 'vendor' ? { title: 'Clear copy for useful products', bio: 'I write concise English product captions and descriptions for clients.', skills: ['Content writing', 'Copywriting'] } : {}) });
    const { user } = ok(response); createdIds.push(user.id); return { ...response, user, email };
}
try {
    check((await request('/api/workspace')).status === 401, 'anonymous users cannot read workspaces');
    check((await request('/api/workspace', undefined, '', { 'oai-authenticated-user-id': 'forged', 'oai-authenticated-user-email': 'forged@example.com' })).status === 401, 'mock identity headers cannot authenticate');
    check((await request('/api/auth')).data.user === null, 'anonymous account status contains no identity');
    check((await request('/api/auth', { action: 'register', email: `weak-${stamp}@pact.local`, password: 'short', name: 'Weak test', role: 'client' })).status === 400, 'short passwords are rejected');
    const client = await register('Client', 'client');
    const vendor = await register('Vendor', 'vendor');
    const outsider = await register('Outsider', 'client');
    check(client.status === 201 && vendor.status === 201, 'separate real client and vendor accounts register');
    check(client.cookie !== vendor.cookie && client.rawCookie.includes('HttpOnly') && client.rawCookie.includes('SameSite=Lax'), 'accounts receive independent protected session cookies');
    const identity = ok(await request('/api/auth', undefined, client.cookie)).user;
    check(identity.id === client.user.id && identity.role === 'client' && !('passwordHash' in identity), 'session resolves the actual account without exposing password data');
    check((await request('/api/auth', { action: 'login', email: client.email, password: password + 'wrong' })).status === 401, 'incorrect passwords cannot sign in');
    check((await request('/api/auth', { action: 'register', email: client.email.toUpperCase(), password, name: 'Duplicate', role: 'vendor' })).status === 400, 'vendor registration requires an actual profile');
    check((await request('/api/auth', { action: 'register', email: client.email.toUpperCase(), password, name: 'Duplicate', role: 'client' })).status === 409, 'email uniqueness is case insensitive');
    check((await request('/api/auth', { action: 'login', email: client.email.toUpperCase(), password })).status === 200, 'real password sign-in normalizes email');
    const workspace = ok(await request('/api/workspace', undefined, client.cookie));
    check(workspace.tasks.length === 0 && workspace.user.id === client.user.id, 'new clients get an empty personal workspace');
    check(workspace.vendors.some(v => v.userId === vendor.user.id) && !workspace.vendors.some(v => v.id.startsWith('demo-')), 'directory contains registered vendors and no sample people');
    check((await request('/api/workspace', { action: 'seed' }, client.cookie)).status >= 400, 'guided-demo seeding is unavailable');
    const profile = { title: 'Concise product writing', bio: 'I write useful English product captions with clear client requirements.', skills: ['Content writing', 'Copywriting'], available: true };
    check((await request('/api/vendors', profile, client.cookie)).status === 403, 'clients cannot invent vendor profiles');
    const updated = ok(await request('/api/vendors', { ...profile, id: client.user.id, name: 'Impersonated name' }, vendor.cookie)).vendor;
    check(updated.id === vendor.user.id && updated.name === vendor.user.name, 'vendors can edit only the profile bound to their own identity');
    check(ok(await request('/api/workspace', undefined, client.cookie)).vendors.filter(v => v.userId === vendor.user.id).length === 1, 'profile edits update the same public record');
    const draft = { title: 'Connected account caption', brief: 'Write one 40 to 60 word English product caption for Bloom, a reusable water bottle for university students. Mention the stainless steel body and leakproof lid. End with the exact sentence: Shop Bloom today. Plain text, no heading.', budget: 10.10, deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), category: 'Content writing', demo: true };
    check((await request('/api/tasks', draft, vendor.cookie)).status === 403, 'vendor accounts cannot create client tasks');
    check((await request('/api/tasks', { ...draft, brief: 'short' }, client.cookie)).status === 400, 'invalid task briefs are rejected before calling AI');
    check((await request('/api/vendors', profile, vendor.cookie, { Origin: 'https://unrelated.example' })).status === 403, 'cross-origin writes are rejected');
    check((await request('/api/vendors', profile, vendor.cookie, { Origin: '' })).status === 403, 'writes without a same-origin header are rejected');
    if (live && workspace.config.paypal.connected) throw new Error('This --live workflow checks simulated payment completion. Use a local environment without PayPal credentials for that check; configured Sandbox checkout requires actual buyer approval.');
    if (live) {
        let { task } = ok(await request('/api/tasks', draft, client.cookie));
        check(task.demo === false && ['gemini', 'groq'].includes(task.messages.at(-1).provider), 'task creation always uses a real Requirements agent even if demo is requested');
        check(task.clientId === client.user.id && task.budget === 10.10, 'new tasks retain client identity and exact budget');
        const id = task.id;
        async function action(account, action, data = {}) { const result = await request(`/api/tasks/${id}/action`, { action, ...data }, account.cookie); if (result.data.task) task = result.data.task; return result; }
        check((await action(outsider, 'cancel')).status === 404, 'unrelated clients cannot access or mutate another client task');
        check((await action(vendor, 'chat', { text: 'Can I see this draft?' })).status === 404, 'vendors cannot read uninvited tasks');
        check((await action(client, 'capture')).status === 409, 'completion is blocked before agreement and review');
        check((await action(client, 'accept_vendor', { role: 'vendor' })).status === 403, 'role spoofing cannot let the client accept for a vendor');
        const agreed = ['Write one English caption of 40 to 60 words with no heading.', 'Mention the stainless steel body.', 'Mention the leakproof lid.', 'End with the exact sentence: Shop Bloom today.'];
        check((await action(client, 'confirm', { requirements: agreed })).status === 200, 'client confirms the scope with a real saved agreement');
        check((await action(client, 'confirm', { requirements: ['Replace the agreement without consent.'] })).status === 409, 'confirmed requirements cannot be silently replaced');
        check((await action(client, 'select_vendor', { vendorId: 'demo-sara' })).status === 400, 'fictional vendor invitations are rejected');
        check((await action(client, 'select_vendor', { vendorId: vendor.user.id })).status === 200, 'client invites an actual registered vendor');
        const inbox = ok(await request('/api/workspace', undefined, vendor.cookie));
        check(inbox.tasks.some(t => t.id === id && t.stage === 'awaiting_vendor'), 'invitation appears in the separate vendor account');
        check(!ok(await request('/api/workspace', undefined, outsider.cookie)).tasks.some(t => t.id === id), 'unrelated workspace cannot list the shared task');
        check((await action(vendor, 'authorize', { role: 'client' })).status === 403, 'vendor cannot authorize as the client');
        check((await action(client, 'authorize')).status === 409, 'payment authorization waits for vendor consent');
        check((await action(vendor, 'accept_vendor')).status === 200 && task.stage === 'funding', 'invited vendor accepts from their own session');
        check((await action(vendor, 'submit', { text: 'Some premature work with enough characters to pass basic validation.' })).status === 409, 'vendor cannot submit before the funding step');
        check((await action(client, 'authorize')).status === 200 && task.payment.mode === 'demo' && task.payment.status === 'authorized', 'only the payment authorization remains simulated');
        check((await action(client, 'submit', { role: 'vendor', text: 'A client cannot impersonate the vendor to submit this work.' })).status === 403, 'client cannot submit as vendor');
        const incomplete = 'Meet Bloom, the reusable water bottle ready for university life. Its stainless steel body fits your busy campus routine. Carry it from morning lectures to evening study sessions, keep it close during long afternoons, and make refilling part of every day. Shop Bloom today.';
        check((await action(vendor, 'submit', { text: incomplete })).status === 200 && task.lastReviewSubmissionId === task.submissions.at(-1).id, 'vendor submission is saved and reviewed by connected AI');
        check(task.requirements.find(r => r.id === 'R3').status === 'missing' && task.stage === 'revision', 'real Review agent identifies the omitted leakproof lid');
        check((await action(client, 'capture')).status === 409, 'missing work blocks final acceptance');
        check((await action(client, 'confirm_review')).status === 400, 'client judgment cannot override explicitly missing work');
        const scope = JSON.stringify(task.requirements.map(({ id, text }) => ({ id, text })));
        check((await action(vendor, 'chat', { role: 'client', text: 'I omitted the leakproof lid. Should I include it in the revised caption?' })).status === 200, 'vendor can ask the real Mediation agent for a follow-up');
        check(task.messages.at(-2).role === 'vendor' && ['gemini', 'groq'].includes(task.messages.at(-1).provider), 'message attribution uses the session, not the supplied role');
        check((await action(client, 'chat', { text: 'Why is there no Urdu translation? Was that included in our confirmed agreement?' })).status === 200, 'client can question the real Mediation agent');
        check(JSON.stringify(task.requirements.map(({ id, text }) => ({ id, text }))) === scope, 'mediation preserves the confirmed scope');
        const complete = 'Meet Bloom, the reusable water bottle ready for university life. Its stainless steel body fits your busy campus routine, while the leakproof lid helps keep your notes dry. Carry it from morning lectures to evening study sessions and make refilling part of every day. Shop Bloom today.';
        check((await action(vendor, 'submit', { text: complete })).status === 200 && task.lastReviewSubmissionId === task.submissions.at(-1).id, 'vendor submits a real revised version for a fresh AI review');
        check(task.submissions.length === 2 && task.submissions[0].text === incomplete, 'both actual submission versions remain saved');
        check(!task.requirements.some(r => r.status === 'missing' || r.status === 'pending'), 'revised caption resolves missing agreed work');
        if (task.requirements.some(r => r.status === 'clarify')) ok(await action(client, 'confirm_review'));
        check((await action(vendor, 'capture')).status === 403, 'vendor cannot accept the work on behalf of the client');
        check((await action(client, 'capture')).status === 200 && task.stage === 'completed' && task.payment.captureId.startsWith('DEMO-'), 'client really accepts the work while payment completion stays simulated');
        check((await action(client, 'capture')).status === 409, 'completed work cannot trigger duplicate payment completion');
        check((await action(vendor, 'submit', { text: complete })).status === 409, 'completed submissions cannot be silently revised');
        check(ok(await request('/api/workspace', undefined, vendor.cookie)).tasks.find(t => t.id === id).stage === 'completed', 'final state is shared with the vendor account');
        console.log('Live workflow used real AI; only payment movements were simulated.');
    }
    const oldCookie = client.cookie;
    check((await request('/api/auth', { action: 'logout' }, client.cookie)).status === 200, 'logout revokes the actual server session');
    check((await request('/api/workspace', undefined, oldCookie)).status === 401, 'a revoked cookie cannot be replayed');
    check((await request('/api/workspace', undefined, vendor.cookie)).status === 200, 'logging out one account leaves the other session independent');
    const signedBackIn = await request('/api/auth', { action: 'login', email: client.email, password });
    check(signedBackIn.status === 200 && ok(await request('/api/workspace', undefined, signedBackIn.cookie)).user.id === client.user.id, 'password login restores the same saved workspace');
    console.log(`\n${passed} ${live ? 'live multi-account' : 'local account'} checks passed.`);
} finally {
    // Only remove disposable accounts created by this test; never touch user accounts.
    if (createdIds.length) {
        assert.ok(createdIds.every(id => /^[0-9a-f-]{36}$/.test(id)));
        const ids = createdIds.map(id => `'${id}'`).join(',');
        const hashes = createdEmails.map(email => `'${createHash('sha256').update('email:' + email).digest('hex')}'`).join(',');
        const sql = `DELETE FROM sessions WHERE account_id IN (${ids}); DELETE FROM pacts WHERE owner_id IN (${ids}); DELETE FROM vendor_profiles WHERE owner_id IN (${ids}); DELETE FROM accounts WHERE id IN (${ids}); DELETE FROM auth_attempts WHERE key IN (${hashes});`;
        const clean = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--command', sql], { encoding: 'utf8' });
        if (clean.status !== 0) { console.error('Disposable account cleanup failed.'); process.exitCode = 1; } else console.log('Disposable test accounts and profiles removed.');
    }
}
