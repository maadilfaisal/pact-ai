import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({entryPoints:['lib/pact/paypal.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'isolated-payment-environment',setup(b){b.onResolve({filter:/^\.\/server$/},args=>args.importer.endsWith('/lib/pact/paypal.ts')?{path:'server',namespace:'pact-test'}:undefined);b.onLoad({filter:/.*/,namespace:'pact-test'},()=>({contents:`export class AppError extends Error {constructor(message,status=400){super(message);this.status=status}} export function secret(name){return globalThis.__pactPaymentTestSecrets[name]||''}`,loader:'js'}));}}]});
const {paypal,validApproval,captureAuthorizedPayment} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const original=globalThis.fetch;let calls=[];let count=0;
function check(value,label){assert.ok(value,label);count++;console.log('PASS '+label);}
function setup(handler,secrets={PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret'}){globalThis.__pactPaymentTestSecrets=secrets;calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return handler(url,options)};}
const token=()=>Response.json({access_token:'fake-test-token'});
try{
 setup(url=>url.endsWith('/token')?token():Response.json({id:'TEST-ORDER'}, {status:201}));
 const order=await paypal('/v2/checkout/orders','POST',{intent:'AUTHORIZE'},'stable-test-key');
 check(order.id==='TEST-ORDER'&&calls.every(c=>c.url.startsWith('https://api-m.sandbox.paypal.com/')),'OAuth and payment requests remain Sandbox-only');
 check(calls[0].options.headers.Authorization==='Basic '+btoa('test-client:test-secret')&&!calls[0].url.includes('test-secret'),'credentials use the OAuth header, not the URL');
 check(calls[1].options.headers.Authorization==='Bearer fake-test-token','payment calls use the returned access token');
 check(calls[1].options.headers.Prefer==='return=representation','payment calls request complete resource details');
 check(calls[1].options.headers['PayPal-Request-Id']==='stable-test-key'&&JSON.parse(calls[1].options.body).intent==='AUTHORIZE','payment calls preserve idempotency and the authorization intent');
 check(calls.every(c=>c.options.signal instanceof AbortSignal),'OAuth and payment calls have bounded timeouts');
 setup(url=>url.endsWith('/token')?token():new Response(null,{status:204}));
 check(JSON.stringify(await paypal('/v2/payments/authorizations/TEST/void','POST',{},'void-key'))==='{}','void accepts an empty successful 204 response');
 setup(()=>new Response('',{status:401}));await assert.rejects(()=>paypal('/v2/checkout/orders'),e=>e.status===502&&e.message.includes('authenticate'));check(calls.length===1,'rejected OAuth credentials prevent the payment call');
 setup(()=>{throw new TypeError('network interrupted')});await assert.rejects(()=>paypal('/v2/checkout/orders'),e=>e.status===502&&e.message.includes('reached'));check(true,'OAuth network failures return a clear retryable error');
 setup(()=>Response.json({}));await assert.rejects(()=>paypal('/v2/checkout/orders'),e=>e.status===502&&e.message.includes('access token'));check(calls.length===1,'missing OAuth token prevents a payment call');
 setup(url=>{if(url.endsWith('/token'))return token();throw new TypeError('network interrupted')});await assert.rejects(()=>paypal('/v2/checkout/orders'),e=>e.status===502&&e.message.includes('reconcile'));check(true,'payment network failures preserve reconciliation guidance');
 setup(url=>url.endsWith('/token')?token():Response.json({name:'ORDER_NOT_APPROVED'},{status:422}));await assert.rejects(()=>paypal('/v2/checkout/orders/TEST/authorize','POST',{}),e=>e.status===502);check(true,'unapproved or rejected operations cannot be recorded as success');
 setup(()=>{throw new Error('must not call network')},{});await assert.rejects(()=>paypal('/v2/checkout/orders'),e=>e.status===503);check(calls.length===0,'missing configuration never calls PayPal');
 const capture={id:'TEST-CAPTURE',status:'COMPLETED',amount:{currency_code:'USD',value:'10.00'}};
 setup(url=>url.endsWith('/token')?token():Response.json(capture));
 check((await captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10)).id==='TEST-CAPTURE'&&calls.length===2,'complete capture responses are verified without an extra resource request');
 check(calls[1].options.headers['PayPal-Request-Id']==='pact-TEST-TASK-capture'&&JSON.parse(calls[1].options.body).final_capture===true,'capture retries keep the same idempotency key and final amount');
 setup(url=>url.endsWith('/token')?token():Response.json(url.endsWith('/capture')?{id:'TEST-CAPTURE',status:'COMPLETED'}:capture));
 check((await captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10)).amount.value==='10.00'&&calls.filter(c=>c.options.method==='POST'&&!c.url.endsWith('/token')).length===1&&calls.at(-1).url.endsWith('/captures/TEST-CAPTURE')&&calls.at(-1).options.method==='GET','minimal capture responses are reconciled by GET without another capture');
 setup(url=>url.endsWith('/token')?token():Response.json(url.endsWith('/capture')?{id:'TEST-CAPTURE',status:'COMPLETED'}:{...capture,amount:{currency_code:'USD',value:'20.00'}}));
 await assert.rejects(()=>captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10),e=>e.status===502&&e.message.includes('amount'));check(true,'reconciled captures with a mismatched amount are rejected');
 setup(url=>url.endsWith('/token')?token():Response.json({...capture,amount:{currency_code:'EUR',value:'10.00'}}));
 await assert.rejects(()=>captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10),e=>e.status===502&&e.message.includes('amount'));check(true,'wrong-currency captures are rejected');
 setup(url=>url.endsWith('/token')?token():Response.json({...capture,status:'PENDING'}));
 await assert.rejects(()=>captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10),e=>e.status===502&&e.message.includes('completed'));check(true,'pending captures cannot complete a task');
 setup(url=>url.endsWith('/token')?token():Response.json(url.endsWith('/capture')?{id:'TEST-CAPTURE',status:'COMPLETED'}:{...capture,id:'OTHER-CAPTURE'}));
 await assert.rejects(()=>captureAuthorizedPayment('TEST-AUTH','TEST-TASK',10),e=>e.status===502&&e.message.includes('details'));check(true,'reconciliation rejects a different capture reference');
 check(validApproval('https://www.sandbox.paypal.com/checkoutnow?token=TEST')&&validApproval('https://sandbox.paypal.com/checkoutnow?token=TEST'),'official Sandbox approval hosts are accepted');
 check(!validApproval('https://www.paypal.com/checkoutnow?token=TEST')&&!validApproval('https://sandbox.paypal.com.evil.example/')&&!validApproval('javascript:alert(1)'),'live, lookalike, and non-HTTPS approval links are rejected');
 console.log(`\n${count} isolated PayPal checks passed. All responses were mocked; no credentials or network requests were used.`);
}finally{globalThis.fetch=original;delete globalThis.__pactPaymentTestSecrets;}
