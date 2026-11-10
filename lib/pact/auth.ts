import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq, and, gt, sql, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, sessions, authAttempts } from '@/db/schema';

export const SESSION_COOKIE = 'pact_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function derive(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `scrypt$16384$8$5$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored?: string) {
    const parts = (stored || '').split('$');
    const valid = parts.length === 6 && parts.slice(0, 4).join('$') === 'scrypt$16384$8$5' && /^[a-f0-9]{128}$/.test(parts[5]);
    const actual = await derive(password, valid ? parts[4] : '00000000000000000000000000000000');
    const expected = valid ? Buffer.from(parts[5], 'hex') : Buffer.alloc(64);
    return timingSafeEqual(actual, expected) && valid;
}
export type Account = { userId: string; email: string; fullName: string; role: 'client' | 'vendor' };
export async function currentAccount(): Promise<Account | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = await getDb().select({ id: accounts.id, email: accounts.email, name: accounts.name, role: accounts.role }).from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id)).where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, Date.now()))).get();
    return row ? { userId: row.id, email: row.email, fullName: row.name, role: row.role } : null;
}
export async function newSession(accountId: string, request: Request) {
    const token = randomBytes(32).toString('hex');
    await getDb().delete(sessions).where(lt(sessions.expiresAt, Date.now()));
    await getDb().insert(sessions).values({ tokenHash: digest(token), accountId, expiresAt: Date.now() + SESSION_SECONDS * 1000 });
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function revokeSession() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, digest(token)));
}
export async function takeAuthAttempt(email: string, request: Request) {
    // Count before password derivation. Keys are hashed and limits survive restarts.
    const keys = [[`email:${email}`, 12], [`ip:${request.headers.get('cf-connecting-ip') || 'local'}`, 120]] as const;
    for (const [value, limit] of keys) {
        const key = digest(value);
        const now = Date.now();
        const [row] = await getDb().insert(authAttempts).values({ key, count: 1, resetAt: now + 15 * 60 * 1000 }).onConflictDoUpdate({ target: authAttempts.key, set: { count: sql`CASE WHEN ${authAttempts.resetAt} <= ${now} THEN 1 ELSE ${authAttempts.count} + 1 END`, resetAt: sql`CASE WHEN ${authAttempts.resetAt} <= ${now} THEN ${now + 15 * 60 * 1000} ELSE ${authAttempts.resetAt} END` } }).returning();
        if (row.count > limit) return false;
    }
    return true;
}
