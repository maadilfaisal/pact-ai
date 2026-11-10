import { AppError, secret } from './server';
const BASE = 'https://api-m.sandbox.paypal.com';
async function accessToken() {
    const id = secret('PAYPAL_CLIENT_ID'), key = secret('PAYPAL_CLIENT_SECRET');
    if (!id || !key) throw new AppError('PayPal Sandbox is not connected yet.', 503);
    let response: Response;
    try {
        response = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${id}:${key}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) });
    } catch {
        throw new AppError('PayPal could not be reached. Your saved work is safe; please retry the payment step.', 502);
    }
    if (!response.ok) throw new AppError('PayPal could not authenticate the sandbox app. Check its server credentials.', 502);
    const result = await response.json() as { access_token?: unknown };
    if (typeof result.access_token !== 'string' || !result.access_token) throw new AppError('PayPal did not return a valid access token. Please retry.', 502);
    return result.access_token;
}
export async function paypal(path: string, method = 'GET', body?: unknown, requestId?: string) { const token = await accessToken(); let response: Response; try {
    response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
}
catch {
    throw new AppError('PayPal did not respond in time. Retry to reconcile the same payment safely.', 502);
} const result = response.status === 204 ? {} : await response.json() as Record<string, unknown>; if (!response.ok) {
    console.warn('PayPal operation failed', response.status, typeof result === 'object' && result ? 'name' in result ? result.name : 'unknown' : 'unknown');
    throw new AppError('PayPal could not complete that step. No successful payment has been recorded; retry to check its status.', 502);
} return result as any; }
export async function captureAuthorizedPayment(authorizationId: string, taskId: string, budget: number) {
    let result = await paypal(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, 'POST', { amount: { currency_code: 'USD', value: budget.toFixed(2) }, final_capture: true }, `pact-${taskId}-capture`);
    if (result.status !== 'COMPLETED' || !result.id)
        throw new AppError('PayPal has not completed the capture yet. Retry to check the same payment.', 502);
    const captureId = result.id;
    // Idempotent retries can replay a minimal response from an earlier request.
    // Retrieve the resource before validating its amount; never skip that check.
    if (!result.amount)
        result = await paypal(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
    if (result.status !== 'COMPLETED' || result.id !== captureId)
        throw new AppError('PayPal has not confirmed the captured payment details. Retry to check the same payment.', 502);
    if (result.amount?.currency_code !== 'USD' || Number(result.amount?.value) !== budget)
        throw new AppError('The captured amount did not match the task. Please check PayPal.', 502);
    return result;
}
export function validApproval(url: string) { try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.sandbox.paypal.com' || u.hostname === 'sandbox.paypal.com');
}
catch {
    return false;
} }
