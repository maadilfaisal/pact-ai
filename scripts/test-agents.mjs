import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

// Adapter tests replace both the environment and fetch; they never call a provider.
const result = await build({
  entryPoints: ['lib/pact/agents.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{name:'isolated-test-environment',setup(builder){
    builder.onResolve({filter:/^\.\/server$/},args=>args.importer.endsWith('/lib/pact/agents.ts')?{path:'server',namespace:'pact-test'}:undefined);
    builder.onLoad({filter:/.*/,namespace:'pact-test'},()=>({contents:`export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} } export function secret(name){return globalThis.__pactAgentTestSecrets[name]||'';}`,loader:'js'}));
  }}],
});
const agents = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch;
let requests=[];let passed=0;
const scope={requirements:['Deliver a 300-word English description.'],questions:['Who is the audience?'],message:'Let’s clarify the audience before confirming.'};
const review={checks:[{id:'R1',status:'met',evidence:'Latest submission evidence.',reason:'The agreed feature appears.'}],message:'The agreed requirement is present.'};
const task={id:'test-task',demo:false,brief:'Write a product description.',requirements:[{id:'R1',text:'Mention stainless steel.',status:'pending'}],submissions:[{id:'old',text:'OLD WORK',version:1},{id:'latest',text:'LATEST WORK with stainless steel.',version:2}],messages:[]};
function check(condition,label){assert.ok(condition,label);passed++;console.log('PASS '+label);}
function setup(secrets,handler){globalThis.__pactAgentTestSecrets=secrets;requests=[];globalThis.fetch=async(url,options)=>{requests.push({url:String(url),options,body:JSON.parse(options.body)});return handler(String(url),options);};}
function gemini(value){return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]});}
function groq(value){return Response.json({choices:[{message:{content:JSON.stringify(value)}}]});}
try{
  setup({GEMINI_API_KEY:'test-gemini'},()=>gemini(scope));
  const first=await agents.clarify('Write a product description.');
  check(first.provider==='gemini'&&first.value.questions.length===1,'requirements agent validates a Gemini response');
  check(!requests[0].url.includes('test-gemini')&&requests[0].options.headers['x-goog-api-key']==='test-gemini','Gemini credential stays in the request header');
  check(requests[0].options.signal instanceof AbortSignal,'provider requests have a bounded timeout');

  setup({GEMINI_API_KEY:'test-gemini',GROQ_API_KEY:'test-groq'},url=>url.includes('googleapis')?new Response('',{status:429}):groq(scope));
  const fallback=await agents.clarify('Write a product description.');
  check(fallback.provider==='groq'&&requests.length===2,'Gemini rate limiting falls back to Groq once');
  check(requests[1].options.headers.Authorization==='Bearer test-groq','fallback uses its own provider credential');

  setup({GEMINI_API_KEY:'test-gemini',GROQ_API_KEY:'test-groq'},url=>url.includes('googleapis')?gemini({requirements:[]}):groq(scope));
  check((await agents.clarify('Write a product description.')).provider==='groq','invalid primary output is rejected before fallback');

  setup({GROQ_API_KEY:'test-groq'},()=>groq(review));
  const reviewed=await agents.review(task);
  check(reviewed.provider==='groq'&&requests.length===1,'Groq can serve as the only configured provider');
  const sent=JSON.parse(requests[0].body.messages[1].content);
  check(sent.submission==='LATEST WORK with stainless steel.','review agent receives the latest submission only');
  check(sent.requirements[0].id==='R1'&&sent.requirements[0].text==='Mention stainless steel.','review uses the confirmed requirement IDs and text');
  check(requests[0].body.messages[0].content.includes('untrusted data'),'agent instructions treat submitted content as untrusted');
  check(requests[0].body.max_tokens===1800&&sent.measurements.wordCount===5,'review has a bounded output budget and measured word count');

  const image={name:'bloom.png',mimeType:'image/png',data:'TEST-IMAGE-BYTES',width:1080,height:1080};
  const imageTask={...task,submissions:[{id:'visual',text:'',version:1,images:[{id:'image-id',key:'private-storage-key',name:image.name}]}]};
  setup({GEMINI_API_KEY:'test-gemini'},()=>gemini(review));
  await agents.review(imageTask,[image]);
  check(requests[0].body.contents[0].parts.some(p=>p.inlineData?.data==='TEST-IMAGE-BYTES'&&p.inlineData.mimeType==='image/png'),'Gemini receives real image content in the review request');
  check(!JSON.stringify(requests[0].body).includes('private-storage-key')&&JSON.parse(requests[0].body.contents[0].parts[0].text).attachedImages[0].width===1080,'review sends measured image metadata without storage keys');
  setup({GROQ_API_KEY:'test-groq'},()=>groq(review));
  await agents.review(imageTask,[image]);
  check(requests[0].body.messages[1].content.some(p=>p.image_url?.url==='data:image/png;base64,TEST-IMAGE-BYTES'),'Groq receives base64 image content for visual review');
  setup({GROQ_API_KEY:'test-groq'},()=>groq({message:'The submitted image contains two circles.',classification:'included'}));
  await agents.mediate(imageTask,'Why is one circle missing?','client',[image]);
  check(requests[0].body.messages[1].content.some(p=>p.type==='image_url'),'mediation includes the latest submitted images when answering questions');
  setup({GROQ_API_KEY:'test-groq'},()=>{throw new Error('must not run without images')});
  await assert.rejects(()=>agents.review(imageTask),e=>e.status===503);
  await assert.rejects(()=>agents.mediate(imageTask,'Explain this image.','client'),e=>e.status===503);
  check(requests.length===0,'image review and mediation cannot silently omit attached visual evidence');

  setup({GEMINI_API_KEY:'test-gemini'},()=>gemini({...review,checks:[{...review.checks[0],id:'invented-id'}]}));
  await assert.rejects(()=>agents.review(task),e=>e.status===502);
  check(true,'review rejects invented or missing requirement IDs');

  setup({GEMINI_API_KEY:'test-gemini'},()=>gemini({message:'A translation is a new request requiring agreement.',classification:'new_request'}));
  const before=JSON.stringify(task.requirements);
  const mediation=await agents.mediate(task,'Please add an Urdu translation.','client');
  check(mediation.value.classification==='new_request'&&JSON.stringify(task.requirements)===before,'mediation classifies extra scope without changing the agreement');
  check(requests[0].body.generationConfig.maxOutputTokens===1824&&requests[0].body.generationConfig.thinkingConfig.thinkingLevel==='low','new Gemini models use low thinking with room for the mediation response');

  setup({GEMINI_API_KEY:'test-gemini',GEMINI_MODEL:'gemini-2.5-flash'},()=>gemini(scope));
  await agents.clarify('Write a product description.');
  check(requests[0].body.generationConfig.thinkingConfig.thinkingBudget===0,'legacy Gemini configuration preserves its supported thinking budget');

  setup({GROQ_API_KEY:'test-groq'},()=>new Response('',{status:429,headers:{'Retry-After':'12'}}));
  await assert.rejects(()=>agents.review(task),e=>e.status===429&&e.message.includes('12 seconds'));
  check(requests.length===1,'provider rate limits retain retry guidance without automatic retry loops');

  setup({},()=>{throw new Error('No network request should be made.');});
  await assert.rejects(()=>agents.clarify('Write a product description.'),e=>e.status===503);
  check(requests.length===0,'missing credentials produce an explicit unavailable result');

  setup({GEMINI_API_KEY:'test-gemini',GROQ_API_KEY:'test-groq'},()=>new Response('',{status:503}));
  await assert.rejects(()=>agents.clarify('Write a product description.'),e=>e.status===503);
  check(requests.length===2,'both providers failing returns an error rather than fabricated AI output');
  console.log(`\n${passed} isolated adapter checks passed. All provider responses were mocked; no credentials or paid requests were used.`);
}finally{globalThis.fetch=originalFetch;delete globalThis.__pactAgentTestSecrets;}
