import { eq, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { pacts } from '@/db/schema';
import { user, configuration, failure, vendorList } from '@/lib/pact/server';
import type { Pact } from '@/lib/pact/types';
export async function GET() { try { const u = await user(); const rows = await getDb().select().from(pacts).where(or(eq(pacts.ownerId, u.userId), eq(pacts.vendorUserId, u.userId))).all(); return Response.json({ tasks: rows.map(r => JSON.parse(r.document) as Pact).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), vendors: await vendorList(), config: configuration(), user: { name: u.fullName, id: u.userId, role: u.role, email: u.email } }, { headers: { 'Cache-Control': 'no-store' } }); } catch (e) { return failure(e); } }
