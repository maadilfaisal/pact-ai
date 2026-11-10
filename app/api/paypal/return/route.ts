import { user, owned, save, acquire, release, AppError } from '@/lib/pact/server';
import { paypal } from '@/lib/pact/paypal';
import { message } from '@/lib/pact/seeds';
export async function GET(request: Request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('task') || '';
    const token = url.searchParams.get('token');
    let lease: {
        owner: string;
        version: number;
    } | undefined;
    try {
        const u = await user();
        const { task, version } = await owned(id, u.userId);
        if (task.clientId !== u.userId || u.role !== 'client') throw new AppError('Only the client can approve payment.', 403);
        if (task.payment.mode !== 'sandbox' || !token || task.payment.orderId !== token)
            throw new AppError('Payment approval could not be verified.');
        if (task.payment.status === 'authorized')
            return Response.redirect(new URL(`/?task=${encodeURIComponent(id)}&payment=authorized`, url.origin));
        if (task.stage !== 'funding' || task.payment.status !== 'created')
            throw new AppError('This payment is no longer awaiting approval.');
        const locked = await acquire(id, u.userId, version);
        lease = { owner: u.userId, version: locked };
        const order = await paypal(`/v2/checkout/orders/${encodeURIComponent(token)}`);
        if (order.purchase_units?.[0]?.custom_id !== task.id || order.purchase_units?.[0]?.amount?.currency_code !== 'USD' || Number(order.purchase_units?.[0]?.amount?.value) !== task.budget)
            throw new AppError('Payment details did not match the agreed task.');
        let authorization = order.purchase_units?.[0]?.payments?.authorizations?.[0];
        if (!authorization) {
            const result = await paypal(`/v2/checkout/orders/${encodeURIComponent(token)}/authorize`, 'POST', {}, `pact-${task.id}-authorize`);
            authorization = result.purchase_units?.[0]?.payments?.authorizations?.[0];
        }
        if (!authorization?.id || authorization.status !== 'CREATED')
            throw new AppError('PayPal has not confirmed the authorization.');
        task.payment.status = 'authorized';
        task.payment.authorizationId = authorization.id;
        task.payment.authorizedAt = new Date().toISOString();
        task.stage = 'working';
        task.messages.push(message('system', 'PayPal Sandbox confirmed the authorization. The test payment is reserved, not captured.'));
        await save(task, u.userId, locked);
        lease = undefined;
        return Response.redirect(new URL(`/?task=${encodeURIComponent(id)}&payment=authorized`, url.origin));
    }
    catch {
        const target = new URL('/', url.origin);
        target.searchParams.set('task', id);
        target.searchParams.set('payment', 'error');
        return Response.redirect(target);
    }
    finally {
        if (lease)
            await release(id, lease.owner, lease.version);
    }
}
