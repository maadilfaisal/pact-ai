import { z } from 'zod';
import { getDb } from '@/db';
import { pacts } from '@/db/schema';
import { user, checkOrigin, jsonBody, failure, configuration, AppError } from '@/lib/pact/server';
import { clarify } from '@/lib/pact/agents';
import { message } from '@/lib/pact/seeds';
import type { Pact } from '@/lib/pact/types';
const schema = z.object({ title: z.string().trim().min(3).max(100), brief: z.string().trim().min(30).max(12000), budget: z.number().min(1).max(10000).refine(v => Math.abs(Math.round(v * 100) - v * 100) < 1e-8, 'Use no more than two decimal places.'), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.enum(['Content writing', 'Copywriting', 'Social media']) });
export async function POST(request: Request) { try {
    checkOrigin(request);
    const u = await user();
    if (u.role !== 'client') throw new AppError('Only clients can create tasks.', 403);
    const parsed = schema.safeParse(await jsonBody(request));
    if (!parsed.success)
        throw new AppError(parsed.error.issues[0].message);
    const input = parsed.data;
    if (!Number.isFinite(Date.parse(input.deadline)) || new Date(input.deadline).toISOString().slice(0, 10) !== input.deadline || input.deadline < new Date().toISOString().slice(0, 10))
        throw new AppError('Choose today or a future delivery date.');
    const config = configuration();
    if (!config.ai.connected)
        throw new AppError('Connect an AI provider on the server before creating a task.');
    const result = await clarify(input.brief);
    const now = new Date().toISOString();
    const task: Pact = { id: crypto.randomUUID(), ...input, demo: false, clientId: u.userId, clientName: u.fullName, stage: 'draft', requirements: result.value.requirements.map((text, i) => ({ id: `R${i + 1}`, text, status: 'pending' })), messages: [message('client', input.brief), message('agent', [result.value.message, ...result.value.questions].join('\n\n'), 'Requirements', result.provider)], payment: { mode: config.paypal.connected ? 'sandbox' : 'demo', status: 'none' }, submissions: [], createdAt: now, updatedAt: now, revision: 0, scopeVersion: 1 };
    await getDb().insert(pacts).values({ id: task.id, ownerId: u.userId, document: JSON.stringify(task), updatedAt: now });
    return Response.json({ task }, { status: 201 });
}
catch (e) {
    return failure(e);
} }
