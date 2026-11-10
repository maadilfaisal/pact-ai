import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, vendorProfiles } from '@/db/schema';
import { currentAccount, hashPassword, verifyPassword, newSession, revokeSession, takeAuthAttempt, SESSION_COOKIE } from '@/lib/pact/auth';
import { AppError, failure, checkOrigin, jsonBody } from '@/lib/pact/server';
const schema = z.object({ action: z.enum(['register', 'login', 'logout']), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()).optional(), password: z.string().min(12).max(128).optional(), name: z.string().trim().min(2).max(60).optional(), role: z.enum(['client', 'vendor']).optional(), skills: z.array(z.string().trim().min(2).max(40)).min(1).max(8).optional(), title: z.string().trim().min(5).max(100).optional(), bio: z.string().trim().min(15).max(500).optional() });
export async function GET() { const account = await currentAccount(); return Response.json({ user: account ? { id: account.userId, name: account.fullName, email: account.email, role: account.role } : null }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) { try {
    checkOrigin(request);
    const parsed = schema.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    const input = parsed.data;
    if (input.action === 'logout') { await revokeSession(); return Response.json({ ok: true }, { headers: { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, 'Cache-Control': 'no-store' } }); }
    if (!input.email || !input.password) throw new AppError('Enter your email and a password of at least 12 characters.');
    if (!await takeAuthAttempt(input.email, request)) throw new AppError('Too many attempts. Please try again in 15 minutes.', 429);
    let account = await getDb().select().from(accounts).where(eq(accounts.email, input.email)).get();
    if (input.action === 'register') {
        if (!input.name || !input.role) throw new AppError('Add your name and choose Client or Vendor.');
        if (input.role === 'vendor' && (!input.skills || !input.title || !input.bio)) throw new AppError('Add your skills, introduction, and a little about your work.');
        if (account) throw new AppError('An account already uses this email. Sign in instead.', 409);
        const row = { id: crypto.randomUUID(), name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password), createdAt: new Date().toISOString() };
        const statements: any[] = [getDb().insert(accounts).values(row)];
        if (input.role === 'vendor') { const vendor = { id: row.id, userId: row.id, name: row.name, initials: row.name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase(), title: input.title!, bio: input.bio!, skills: input.skills!, color: 'pink', available: true, demo: false }; statements.push(getDb().insert(vendorProfiles).values({ id: row.id, ownerId: row.id, document: JSON.stringify(vendor) })); }
        try { await getDb().batch(statements as [any, ...any[]]); } catch (error) { if (String(error).includes('UNIQUE')) throw new AppError('An account already uses this email. Sign in instead.', 409); throw error; }
        account = row;
    } else if (!await verifyPassword(input.password, account?.passwordHash) || !account) { throw new AppError('The email or password is incorrect.', 401); }
    const cookie = await newSession(account!.id, request);
    return Response.json({ user: { id: account!.id, name: account!.name, email: account!.email, role: account!.role } }, { status: input.action === 'register' ? 201 : 200, headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
} catch (error) { return failure(error); } }
