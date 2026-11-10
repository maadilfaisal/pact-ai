import { z } from 'zod';
import { user, checkOrigin, jsonBody, failure, owned, save, acquire, release, AppError, vendorList } from '@/lib/pact/server';
import { clarify, review, mediate, applyReview } from '@/lib/pact/agents';
import { message } from '@/lib/pact/seeds';
import { paypal, validApproval, captureAuthorizedPayment } from '@/lib/pact/paypal';
import type { Pact, Stage } from '@/lib/pact/types';
import { submissionForm, storeImages, reviewImages, imageBucket } from '@/lib/pact/files';
const schema = z.object({ action: z.enum(['clarify', 'confirm', 'select_vendor', 'accept_vendor', 'authorize', 'submit', 'review', 'chat', 'request_revision', 'confirm_review', 'capture', 'cancel']), text: z.string().trim().max(30000).optional(), vendorId: z.string().max(100).optional(), requirements: z.array(z.string().trim().min(5).max(600)).min(1).max(10).optional() });
function stage(task: Pact, allowed: Stage[]) { if (!allowed.includes(task.stage))
    throw new AppError('That action is not available at this stage. Refresh to see the next step.', 409); }
export async function POST(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    let lease: {
        id: string;
        owner: string;
        version: number;
    } | undefined;
    const createdImages: string[] = [];
    let imagesCommitted = false;
    try {
        checkOrigin(request);
        const u = await user();
        const { id } = await params;
        const found = await owned(id, u.userId);
        const form = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await submissionForm(request) : undefined;
        const parsed = schema.safeParse(form ? form.input : await jsonBody(request));
        if (!parsed.success)
            throw new AppError('Please check your message and try again.');
        const input = parsed.data;
        const task = found.task;
        const role = task.clientId === u.userId ? 'client' : 'vendor';
        if ((u.role !== role) || (role === 'vendor' && task.vendorUserId !== u.userId)) throw new AppError('Your account cannot act on this task.', 403);
        const clientActions = ['clarify', 'confirm', 'select_vendor', 'authorize', 'request_revision', 'confirm_review', 'capture', 'cancel'];
        const vendorActions = ['accept_vendor', 'submit'];
        if ((clientActions.includes(input.action) && role !== 'client') || (vendorActions.includes(input.action) && role !== 'vendor')) throw new AppError('This action belongs to the other participant.', 403);
        const version = await acquire(id, found.ownerId, found.version);
        lease = { id, owner: found.ownerId, version };
        const now = new Date().toISOString();
        let redirect: string | undefined;
        let warning: string | undefined;
        switch (input.action) {
            case 'clarify': {
                stage(task, ['draft']);
                if (!input.text || input.text.length < 3)
                    throw new AppError('Add a little more detail first.');
                task.messages.push(message('client', input.text));
                const result = await clarify(task.brief, task.messages);
                task.requirements = result.value.requirements.map((text, i) => ({ id: `R${i + 1}`, text, status: 'pending' }));
                task.messages.push(message('agent', [result.value.message, ...result.value.questions].join('\n\n'), 'Requirements', result.provider));
                break;
            }
            case 'confirm': {
                stage(task, ['draft']);
                if (!input.requirements)
                    throw new AppError('Review the checklist before confirming.');
                task.requirements = input.requirements.map((text, i) => ({ id: `R${i + 1}`, text, status: 'pending' }));
                task.confirmedAt = now;
                task.stage = 'matching';
                task.messages.push(message('system', 'The client confirmed agreement v1. The vendor will accept this same checklist before work begins.'));
                break;
            }
            case 'select_vendor': {
                stage(task, ['matching']);
                const vendors = await vendorList();
                if (!vendors.some(v => v.id === input.vendorId && v.available))
                    throw new AppError('Choose an available vendor.');
                task.vendorId = input.vendorId;
                task.vendorUserId = vendors.find(v => v.id === input.vendorId)!.userId;
                task.stage = 'awaiting_vendor';
                task.messages.push(message('system', 'The selected vendor has been invited to review the agreement.'));
                break;
            }
            case 'accept_vendor': {
                stage(task, ['awaiting_vendor']);
                task.vendorAcceptedAt = now;
                task.stage = 'funding';
                task.messages.push(message('vendor', 'I’ve read and accepted the confirmed checklist, budget, and deadline.'));
                break;
            }
            case 'authorize': {
                stage(task, ['funding']);
                if (task.payment.mode === 'demo') {
                    task.payment = { mode: 'demo', status: 'authorized', authorizationId: `DEMO-AUTH-${task.id.slice(0, 8)}`, authorizedAt: now };
                    task.stage = 'working';
                    task.messages.push(message('system', 'Demo payment authorized. No real money moved.'));
                }
                else {
                    if (task.payment.orderId && task.payment.status === 'created' && task.payment.approvalUrl) {
                        redirect = task.payment.approvalUrl;
                        break;
                    }
                    const origin = new URL(request.url).origin;
                    const result = await paypal('/v2/checkout/orders', 'POST', { intent: 'AUTHORIZE', purchase_units: [{ reference_id: task.id, custom_id: task.id, description: task.title, amount: { currency_code: 'USD', value: task.budget.toFixed(2) } }], payment_source: { paypal: { experience_context: { user_action: 'CONTINUE', shipping_preference: 'NO_SHIPPING', return_url: `${origin}/api/paypal/return?task=${encodeURIComponent(task.id)}`, cancel_url: `${origin}/?task=${encodeURIComponent(task.id)}&payment=cancelled` } } } }, `pact-${task.id}-create`);
                    const approval = result.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
                    if (!result.id || !approval || !validApproval(approval))
                        throw new AppError('PayPal did not return a valid sandbox checkout link.', 502);
                    task.payment = { mode: 'sandbox', status: 'created', orderId: result.id, approvalUrl: approval };
                    redirect = approval;
                }
                break;
            }
            case 'submit': {
                stage(task, ['working', 'revision']);
                if (task.payment.status !== 'authorized')
                    throw new AppError('Authorize payment before submitting work.');
                const files = form?.files || [];
                if (!files.length && (!input.text || input.text.length < 40))
                    throw new AppError('Add your completed text (at least 40 characters) or attach an image.');
                if (task.submissions.length >= 20)
                    throw new AppError('This task supports up to 20 submission versions.');
                if (task.submissions.reduce((n, s) => n + (s.images?.length || 0), 0) + files.length > 24)
                    throw new AppError('This task supports up to 24 saved images across all submission versions.');
                const submissionId = crypto.randomUUID();
                const images = await storeImages(task.id, submissionId, files, createdImages);
                task.submissions.push({ id: submissionId, text: input.text || '', at: now, version: task.submissions.length + 1, ...(images.length ? { images } : {}) });
                task.messages.push(message('vendor', `Submitted version ${task.submissions.length} for review.`));
                try {
                    const result = await review(task, await reviewImages(task));
                    task.requirements = applyReview(task.requirements, result.value.checks);
                    task.lastReviewSubmissionId = task.submissions.at(-1)!.id;
                    task.revision++;
                    task.stage = task.requirements.every(r => r.status === 'met') ? 'ready' : 'revision';
                    task.messages.push(message('agent', result.value.message, 'Review', result.provider));
                }
                catch (error) {
                    if (!(error instanceof AppError))
                        throw error;
                    task.requirements = task.requirements.map(r => ({ id: r.id, text: r.text, status: 'pending' }));
                    task.lastReviewSubmissionId = undefined;
                    task.stage = 'revision';
                    warning = 'Your submission is saved. ' + error.message + ' Use Retry review when you’re ready.';
                    task.messages.push(message('system', warning));
                }
                break;
            }
            case 'review': {
                stage(task, ['working', 'revision']);
                const result = await review(task, await reviewImages(task));
                task.requirements = applyReview(task.requirements, result.value.checks);
                task.lastReviewSubmissionId = task.submissions.at(-1)!.id;
                task.stage = task.requirements.every(r => r.status === 'met') ? 'ready' : 'revision';
                task.messages.push(message('agent', result.value.message, 'Review', result.provider));
                break;
            }
            case 'chat': {
                stage(task, ['working', 'revision', 'ready']);
                if (!input.text || input.text.length < 2)
                    throw new AppError('Write your question first.');
                task.messages.push(message(role, input.text));
                const result = await mediate(task, input.text, role, await reviewImages(task));
                task.messages.push(message('agent', result.value.message, 'Mediator', result.provider));
                break;
            }
            case 'request_revision': {
                stage(task, ['ready', 'revision']);
                if (!input.text || input.text.length < 5)
                    throw new AppError('Explain which agreed requirement needs revision.');
                task.messages.push(message('client', input.text));
                const result = await mediate(task, input.text, 'client', await reviewImages(task));
                task.messages.push(message('agent', result.value.message, 'Mediator', result.provider));
                if (result.value.classification !== 'new_request')
                    task.stage = 'revision';
                break;
            }
            case 'confirm_review': {
                stage(task, ['revision']);
                if (task.requirements.some(r => r.status === 'missing'))
                    throw new AppError('Missing requirements need a vendor revision first.');
                if (task.lastReviewSubmissionId !== task.submissions.at(-1)?.id)
                    throw new AppError('Review the latest submission first.');
                task.requirements = task.requirements.map(r => r.status === 'clarify' ? { ...r, status: 'met', reason: 'Explicitly verified by the client.', evidence: `Client confirmed this criterion for submission version ${task.submissions.length}.` } : r);
                task.stage = 'ready';
                task.messages.push(message('client', 'I’ve reviewed and confirmed the criteria that needed human judgment.'));
                break;
            }
            case 'capture': {
                stage(task, ['ready']);
                if (task.requirements.some(r => r.status !== 'met') || task.lastReviewSubmissionId !== task.submissions.at(-1)?.id)
                    throw new AppError('Every requirement must be resolved for the latest submission.');
                if (task.payment.status !== 'authorized' || !task.payment.authorizationId)
                    throw new AppError('A valid authorization is required.');
                if (task.payment.mode === 'demo') {
                    task.payment.status = 'captured';
                    task.payment.captureId = `DEMO-CAP-${task.id.slice(0, 8)}`;
                }
                else {
                    const result = await captureAuthorizedPayment(task.payment.authorizationId, task.id, task.budget);
                    task.payment.status = 'captured';
                    task.payment.captureId = result.id;
                }
                task.clientAcceptedAt = now;
                task.payment.capturedAt = now;
                task.stage = 'completed';
                task.messages.push(message('client', 'I accept the final submission against our confirmed agreement.'));
                task.messages.push(message('system', task.payment.mode === 'demo' ? 'Demo payment completed. No real money moved.' : 'PayPal Sandbox confirmed the capture. Test funds were received by the configured sandbox merchant.'));
                break;
            }
            case 'cancel': {
                stage(task, ['draft', 'matching', 'awaiting_vendor', 'funding', 'working', 'revision', 'ready']);
                if (task.payment.status === 'authorized' && task.payment.authorizationId) {
                    if (task.payment.mode === 'sandbox')
                        await paypal(`/v2/payments/authorizations/${encodeURIComponent(task.payment.authorizationId)}/void`, 'POST', {}, `pact-${task.id}-void`);
                    task.payment.status = 'voided';
                }
                task.stage = 'cancelled';
                task.messages.push(message('system', 'The task was cancelled. Any recorded uncaptured authorization has been voided.'));
                break;
            }
        }
        const saved = await save(task, found.ownerId, version);
        imagesCommitted = true;
        lease = undefined;
        return Response.json({ task: saved, ...(redirect ? { redirect } : {}), ...(warning ? { warning } : {}) });
    }
    catch (e) {
        return failure(e);
    }
    finally {
        if (createdImages.length && !imagesCommitted) {
            try { await imageBucket().delete(createdImages); }
            catch { console.warn('Uncommitted image cleanup needs attention.'); }
        }
        if (lease)
            await release(lease.id, lease.owner, lease.version);
    }
}
