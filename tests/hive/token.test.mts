// Token tests for /api/hive/token's signer and the claims hive-server checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { hiveSecret, signHiveToken, verifyHiveToken, HIVE_AUDIENCE, HIVE_TOKEN_TTL_S } from '../../lib/hive/token-core.ts';

const SECRET = hiveSecret('test-secret-that-is-long-enough-0123456789')!;
const OTHER = hiveSecret('another-secret-that-is-long-enough-987654')!;
const SUB = '22222222-2222-4222-8222-222222222222';

test('short or missing secrets are refused', () => {
  assert.equal(hiveSecret(undefined), null);
  assert.equal(hiveSecret(''), null);
  assert.equal(hiveSecret('x'.repeat(31)), null);
  assert.ok(hiveSecret('x'.repeat(32)));
});

test('signed token verifies with aud hive-data, sub, role and a 10 minute expiry', async () => {
  const { token, expiresAt } = await signHiveToken(SECRET, SUB, 'member');
  const v = await verifyHiveToken(SECRET, token);
  assert.equal(v.sub, SUB);
  assert.equal(v.role, 'member');
  assert.ok(Math.abs(expiresAt - (Date.now() + HIVE_TOKEN_TTL_S * 1000)) < 5000);
  assert.equal(HIVE_TOKEN_TTL_S, 600);
});

test('wrong secret, expired, wrong audience, wrong algorithm, bad role and garbage are rejected', async () => {
  const { token } = await signHiveToken(SECRET, SUB, 'member');
  await assert.rejects(verifyHiveToken(OTHER, token));
  const expired = await signHiveToken(SECRET, SUB, 'member', -60);
  await assert.rejects(verifyHiveToken(SECRET, expired.token));
  const now = Math.floor(Date.now() / 1000);
  const wrongAud = await new SignJWT({ role: 'member' }).setProtectedHeader({ alg: 'HS256' }).setSubject(SUB).setAudience('other').setIssuer('sova').setExpirationTime(now + 60).sign(SECRET);
  await assert.rejects(verifyHiveToken(SECRET, wrongAud));
  const hs512 = await new SignJWT({ role: 'member' }).setProtectedHeader({ alg: 'HS512' }).setSubject(SUB).setAudience(HIVE_AUDIENCE).setIssuer('sova').setExpirationTime(now + 60).sign(new Uint8Array(64).fill(1));
  await assert.rejects(verifyHiveToken(SECRET, hs512));
  const badRole = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject(SUB).setAudience(HIVE_AUDIENCE).setIssuer('sova').setExpirationTime(now + 60).sign(SECRET);
  await assert.rejects(verifyHiveToken(SECRET, badRole));
  await assert.rejects(verifyHiveToken(SECRET, 'not.a.token'));
  // A SOVA session cookie (no aud) must not work as a data token.
  const session = await new SignJWT({ userId: SUB, email: 'a@b.co' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(SECRET);
  await assert.rejects(verifyHiveToken(SECRET, session));
});
