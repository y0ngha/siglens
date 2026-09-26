import { describe, expect, it } from 'vitest';
import { metadata as analysisMetadata } from '../stock-analysis/page';
import { metadata as chatMetadata } from '../stock-chat/page';

const CRYPTO_RE =
    /코인|비트코인|이더리움|암호화폐|가상자산|크립토|crypto|bitcoin/i;

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

    it('title and description carry no crypto wording', () => {
        const text = `${String(metadata.title)} ${metadata.description}`;
        expect(metadata.description).toBeTruthy();
        expect(text).not.toMatch(CRYPTO_RE);
        expect(text).not.toMatch(/[·—]/);
    });
});
