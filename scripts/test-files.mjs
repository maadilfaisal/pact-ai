import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const built = await build({entryPoints:['lib/pact/files.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'isolated-storage',setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fake'}));
    b.onResolve({filter:/^\.\/server$/},args=>args.importer.endsWith('/lib/pact/files.ts')?{path:'server',namespace:'fake'}:undefined);
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='env'?`export const env={get BUCKET(){return globalThis.__pactFileBucket}}`:`export class AppError extends Error {constructor(message,status=400){super(message);this.status=status}}`,loader:'js'}));
}}]});
const { imageDetails, storeImages, reviewImages, submissionForm, MAX_IMAGE_BYTES } = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
let passed=0;const objects=new Map();
globalThis.__pactFileBucket={async put(key,bytes){objects.set(key,new Uint8Array(bytes))},async get(key){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null}};
function check(value,label){assert.ok(value,label);passed++;console.log('PASS '+label)}
const png=readFileSync('scripts/fixtures/bloom.png'),jpg=readFileSync('scripts/fixtures/bloom.jpg');
const file=(bytes=png,name='bloom.png',type='image/png')=>new File([bytes],name,{type});
function request(files,action='submit'){const form=new FormData();form.set('action',action);form.set('text','Here is my work.');for(const f of files)form.append('images',f);return new Request('http://localhost/api/tasks/TEST/action',{method:'POST',body:form})}
try{
    check(imageDetails(png,'image/png').width===1080&&imageDetails(png,'image/png').height===1080,'PNG dimensions are measured from image bytes');
    check(imageDetails(jpg,'image/jpeg').width===1080,'JPG dimensions are measured from image bytes');
    assert.throws(()=>imageDetails(png,'image/jpeg'));check(true,'a mismatched declared MIME type is rejected');
    assert.throws(()=>imageDetails(Buffer.from('<svg onload="alert(1)"/>'),'image/png'));check(true,'SVG and disguised non-image payloads are rejected');
    const huge=Buffer.from(png);huge.writeUInt32BE(5000,16);assert.throws(()=>imageDetails(huge,'image/png'));check(true,'oversized pixel dimensions are rejected');
    const parsed=await submissionForm(request([file(),file(jpg,'bloom.jpg','image/jpeg')]));check(parsed.files.length===2&&parsed.input.action==='submit','multipart submission accepts PNG and JPG file parts');
    await assert.rejects(()=>submissionForm(request([file(),file(),file(),file()])));check(true,'more than three image attachments are rejected');
    await assert.rejects(()=>submissionForm(request([file()],'capture')));check(true,'multipart files cannot trigger payment or other actions');
    const bad=new FormData();bad.set('action','submit');bad.set('images','forged-file-key');await assert.rejects(()=>submissionForm(new Request('http://localhost/',{method:'POST',body:bad})));check(true,'client-supplied strings cannot forge stored image references');
    const streamed=new Request('http://localhost/',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(3*MAX_IMAGE_BYTES+80_001));c.close()}}),duplex:'half'});
    await assert.rejects(()=>submissionForm(streamed),e=>e.status===413);check(true,'streamed oversized requests are rejected without trusting Content-Length');
    const keys=[];const images=await storeImages('TASK','VERSION',[file(png,'../bloom.png')],keys);
    check(images.length===1&&images[0].name==='.._bloom.png'&&keys[0].startsWith('work/TASK/VERSION/'),'stored images get generated task/version keys and safe display names');
    const task={submissions:[{text:'',images}]};const loaded=await reviewImages(task);
    check(loaded[0].data===png.toString('base64')&&loaded[0].width===1080,'review loads the actual private image bytes and measured dimensions');
    const before=objects.size;await assert.rejects(()=>storeImages('TASK','BAD',[file(),file(Buffer.from('bad'))],[]));check(objects.size===before,'a bad selection is fully validated before writing any images');
    await assert.rejects(()=>storeImages('TASK','BIG',[file(new Uint8Array(MAX_IMAGE_BYTES+1))],[]),e=>e.status===413);check(objects.size===before,'oversized files cannot create stored objects');
    objects.delete(images[0].key);await assert.rejects(()=>reviewImages(task),e=>e.status===503);check(true,'missing stored images fail review instead of fabricating visual evidence');
    delete globalThis.__pactFileBucket;await assert.rejects(()=>storeImages('TASK','NO-STORAGE',[file()],[]),e=>e.status===503);check(true,'missing storage returns an explicit unavailable result');
    console.log(`\n${passed} isolated image checks passed. No external services were called.`);
} finally {delete globalThis.__pactFileBucket}
