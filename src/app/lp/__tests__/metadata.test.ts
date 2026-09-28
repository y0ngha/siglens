import { describe, expect, it } from 'vitest';
import { metadata as analysisMetadata } from '../stock-analysis/page';
import { lpCopyViolations } from '@/views/lp/__tests__/lpCopyRules';
import { metadata as chatMetadata } from '../stock-chat/page';

describe.each([
    ['/lp/stock-analysis', analysisMetadata],
    ['/lp/stock-chat', chatMetadata],
])('%s metadata', (_path, metadata) => {
    it('is noindex/nofollow with no canonical, alternates or social cards', () => {
        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates).toBeUndefined();
        expect(metadata.openGraph).toBeUndefined();
        expect(metadata.twitter).toBeUndefined();
    });

    it('title and description carry no crypto wording or "티커"', () => {
        const text = `${String(metadata.title)} ${metadata.description}`;
        expect(metadata.description).toBeTruthy();
        expect(lpCopyViolations(text)).toEqual([]);
    });
});
