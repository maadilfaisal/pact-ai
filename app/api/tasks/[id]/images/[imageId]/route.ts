import { user, owned, failure, AppError } from '@/lib/pact/server';
import { imageBucket } from '@/lib/pact/files';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
    try {
        const u = await user();
        const { id, imageId } = await params;
        const { task } = await owned(id, u.userId);
        const image = task.submissions.flatMap(s => s.images || []).find(i => i.id === imageId);
        if (!image) throw new AppError('This image could not be found.', 404);
        const object = await imageBucket().get(image.key);
        if (!object) throw new AppError('This image is unavailable. Please try again.', 404);
        return new Response(object.body, { headers: {
            'Content-Type': image.mimeType,
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(image.name)}`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        } });
    } catch (e) { return failure(e); }
}
