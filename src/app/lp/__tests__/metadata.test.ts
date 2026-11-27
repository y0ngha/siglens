vi.mock('server-only', () => ({}));
vi.mock('../stock-analysis/_lib/loadLpRealAnalyses', () => ({
    loadLpRealAnalyses: vi.fn(),
}));

import { describe, expect, it, vi } from 'vitest';
import { lpCopyViolations } from '@/views/lp/lib/lpCopyRules';
import {
    metadata as analysisMetadata,
    revalidate as analysisRevalidate,
} from '../stock-analysis/page';
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

describe('/lp/stock-analysis ISR', () => {
    it('declares the 6h revalidate literal shared with the symbol page', () => {
        expect(analysisRevalidate).toBe(21600);
    });
});
