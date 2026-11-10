import { env } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { AppError } from './server';
import type { AgentImage, Pact, WorkImage } from './types';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 3;
const MAX_BODY = MAX_IMAGES * MAX_IMAGE_BYTES + 80_000;
export function imageBucket(): R2Bucket {
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!bucket) throw new AppError('Image storage is not connected. Please try text work for now.', 503);
    return bucket;
}

export async function submissionForm(request: Request) {
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY)
        throw new AppError('Attach up to 3 images, no larger than 2 MB each.', 413);
    if (!request.body) throw new AppError('Add your work before submitting.');
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > MAX_BODY) {
                await reader.cancel();
                throw new AppError('Attach up to 3 images, no larger than 2 MB each.', 413);
            }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try {
        form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    } catch { throw new AppError('The upload was interrupted. Choose the images and try again.'); }
    if (form.getAll('action').length !== 1 || form.get('action') !== 'submit' || form.getAll('text').length > 1 || [...form.keys()].some(k => !['action', 'text', 'images'].includes(k)))
        throw new AppError('Images can only be attached to a work submission.');
    const entries = form.getAll('images');
    if (entries.length > MAX_IMAGES || entries.some(f => typeof f === 'string'))
        throw new AppError('Attach up to 3 PNG or JPG images.');
    const text = form.get('text');
    if (text !== null && typeof text !== 'string') throw new AppError('Please write your notes as text.');
    return { input: { action: 'submit', text: text || '' }, files: entries as File[] };
}

export function imageDetails(bytes: Uint8Array, declaredType: string) {
    let mimeType: WorkImage['mimeType'];
    let width = 0, height = 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 33 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10])) && Buffer.from(bytes.subarray(12,16)).toString() === 'IHDR') {
        mimeType = 'image/png'; width = view.getUint32(16); height = view.getUint32(20);
    } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
        mimeType = 'image/jpeg';
        let offset = 2;
        while (offset + 3 < bytes.length) {
            if (bytes[offset++] !== 255) break;
            while (offset < bytes.length && bytes[offset] === 255) offset++;
            const marker = bytes[offset++];
            if (marker === 217 || marker === 218) break;
            if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
            if (offset + 2 > bytes.length) break;
            const size = view.getUint16(offset);
            if (size < 2 || offset + size > bytes.length) break;
            if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size >= 8) {
                height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
            }
            offset += size;
        }
    } else throw new AppError('Please upload a PNG or JPG image. SVG, PDF, and other files are not supported.');
    if (mimeType !== declaredType) throw new AppError('The image format does not match its file type. Export it as PNG or JPG and try again.');
    if (!width || !height || width > 4096 || height > 4096)
        throw new AppError('Use images up to 4096 × 4096 pixels.');
    return { mimeType, width, height };
}

export async function storeImages(taskId: string, submissionId: string, files: File[], created: string[]): Promise<WorkImage[]> {
    if (files.length > MAX_IMAGES) throw new AppError('Attach up to 3 images.');
    // Validate the entire selection before writing any objects.
    const prepared = await Promise.all(files.map(async file => {
        if (!file.size || file.size > MAX_IMAGE_BYTES) throw new AppError('Each image must be between 1 byte and 2 MB.', 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { bytes, name: file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 120) || 'image', ...imageDetails(bytes, file.type) };
    }));
    const result: WorkImage[] = [];
    for (const file of prepared) {
        const id = crypto.randomUUID();
        const key = `work/${taskId}/${submissionId}/${id}`;
        await imageBucket().put(key, file.bytes, { httpMetadata: { contentType: file.mimeType } });
        created.push(key);
        result.push({ id, key, name: file.name, mimeType: file.mimeType, size: file.bytes.byteLength, width: file.width, height: file.height });
    }
    return result;
}

export async function reviewImages(task: Pact): Promise<AgentImage[]> {
    return Promise.all((task.submissions.at(-1)?.images || []).map(async image => {
        const object = await imageBucket().get(image.key);
        if (!object) throw new AppError('A submitted image could not be loaded. Your work is saved; please retry review.', 503);
        return { name: image.name, mimeType: image.mimeType, width: image.width, height: image.height, data: Buffer.from(await object.arrayBuffer()).toString('base64') };
    }));
}
