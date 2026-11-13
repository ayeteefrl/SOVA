// Chart Hive gate tests with mocked lookups (no real accounts, no Supabase).
// Run: npm run test:hive
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHiveAccess, ownerIdFrom, isMissingTable, ttlCache, hasHiveAccess } from '../../lib/hive/access-core.ts';
import { parseEmail, parseNote, escapeLike, pickAccount } from '../../lib/hive/admin-core.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';

const lookups = (members: string[], existing = [OWNER, MEMBER, STRANGER]) => ({
  userExists: async (id: string) => existing.includes(id),
  isMember: async (id: string) => members.includes(id),
});

test('logged out: none, not signed in', async () => {
  for (const sid of [null, undefined, '', 'not-a-uuid']) {
    const a = await resolveHiveAccess(sid as string | null, OWNER, lookups([MEMBER]));
    assert.deepEqual(a, { role: 'none', userId: null, signedIn: false });
  }
});

test('owner gets owner, member gets member, stranger gets none', async () => {
  assert.equal((await resolveHiveAccess(OWNER, OWNER, lookups([MEMBER]))).role, 'owner');
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, lookups([MEMBER]))).role, 'member');
  const s = await resolveHiveAccess(STRANGER, OWNER, lookups([MEMBER]));
  assert.deepEqual(s, { role: 'none', userId: STRANGER, signedIn: true });
  assert.equal(hasHiveAccess(s), false);
});

test('owner env unset or invalid: nobody gets in, including members and the would-be owner', async () => {
  for (const env of [undefined, '', '  ', 'owner@example.com', 'abc', OWNER + 'x']) {
    for (const id of [OWNER, MEMBER, STRANGER]) {
      const a = await resolveHiveAccess(id, env, lookups([MEMBER]));
      assert.equal(a.role, 'none', `env=${env} id=${id}`);
      assert.equal(a.signedIn, true);
    }
  }
});

test('owner id matching is case-insensitive and trims whitespace', async () => {
  assert.equal(ownerIdFrom(`  ${OWNER.toUpperCase()} `), OWNER);
  assert.equal((await resolveHiveAccess(OWNER.toUpperCase(), ` ${OWNER} `, lookups([]))).role, 'owner');
});

test('removed member: next check is none', async () => {
  const members = [MEMBER];
  const l = lookups(members);
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, l)).role, 'member');
  members.length = 0;
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, l)).role, 'none');
});

test('deleted account with a still-valid cookie: none, even for the owner id', async () => {
  assert.equal((await resolveHiveAccess(OWNER, OWNER, lookups([], [MEMBER]))).role, 'none');
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, lookups([MEMBER], [OWNER]))).role, 'none');
});

test('lookup errors fail closed', async () => {
  const boom = { userExists: async () => { throw new Error('db down'); }, isMember: async () => true };
  assert.equal((await resolveHiveAccess(OWNER, OWNER, boom)).role, 'none');
  const boom2 = { userExists: async () => true, isMember: async () => { throw new Error('db down'); } };
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, boom2)).role, 'none');
  assert.equal((await resolveHiveAccess(OWNER, OWNER, boom2)).role, 'owner', 'owner does not depend on the membership table');
});

test('missing hive_access table: owner still gets in, nobody else does', async () => {
  // access.ts maps a missing-table error to isMember() === false; mirror that here.
  const missing = { code: 'PGRST205', message: "Could not find the table 'public.hive_access' in the schema cache" };
  const l = { userExists: async () => true, isMember: async () => (isMissingTable(missing) ? false : true) };
  assert.equal((await resolveHiveAccess(OWNER, OWNER, l)).role, 'owner');
  assert.equal((await resolveHiveAccess(MEMBER, OWNER, l)).role, 'none');
  assert.ok(isMissingTable({ code: '42P01' }));
  assert.ok(isMissingTable({ message: 'relation "hive_access" does not exist' }));
  assert.ok(!isMissingTable({ code: '23505', message: 'duplicate key' }));
  assert.ok(!isMissingTable(null));
});

test('ttlCache expires entries', async () => {
  const c = ttlCache<boolean>(30);
  c.set('a', true);
  assert.equal(c.get('a'), true);
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(c.get('a'), undefined);
});

test('email and note validation', () => {
  assert.equal(parseEmail(' a@b.co '), 'a@b.co');
  for (const bad of ['', 'a', 'a@b', '@b.co', 'a b@c.co', 'x'.repeat(250) + '@b.co', 42, null, { email: 'a@b.co' }]) assert.equal(parseEmail(bad), null);
  assert.equal(parseNote(undefined), null);
  assert.equal(parseNote(''), null);
  assert.equal(parseNote(' hi '), 'hi');
  assert.equal(parseNote('x'.repeat(201)), undefined);
  assert.equal(parseNote(5), undefined);
  assert.equal(escapeLike('a_b%c\\d@x.com'), 'a\\_b\\%c\\\\d@x.com');
});

test('account matching: exact first, unique case-insensitive next, ambiguity refused, unknown refused', () => {
  const A = { id: '1', email: 'Foo@x.com' };
  const B = { id: '2', email: 'foo@x.com' };
  assert.deepEqual(pickAccount('Foo@x.com', [A], [A, B]), { account: A });
  assert.deepEqual(pickAccount('FOO@x.com', [], [A]), { account: A });
  assert.deepEqual(pickAccount('FOO@x.com', [], [A, B]), { error: 'ambiguous' });
  assert.deepEqual(pickAccount('nobody@x.com', [], []), { error: 'none' });
});
