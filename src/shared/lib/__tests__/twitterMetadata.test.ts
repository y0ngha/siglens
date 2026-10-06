import { describe, expect, it } from 'vitest';
import { buildTwitterMetadata, X_HANDLE } from '../twitterMetadata';
import { X_URL } from '../seo';

describe('buildTwitterMetadata', () => {
    it('twitter:site를 서비스 계정으로 싣고 기본 카드는 summary_large_image다', () => {
        expect(buildTwitterMetadata({ title: 't', description: 'd' })).toEqual({
            card: 'summary_large_image',
            site: '@siglens_io',
            title: 't',
            description: 'd',
        });
    });

    it('images는 있을 때만, card는 지정한 값으로 낸다', () => {
        const meta = buildTwitterMetadata({
            card: 'summary',
            title: 't',
            description: 'd',
            images: ['/og-image.png'],
        });
        expect(meta).toMatchObject({
            card: 'summary',
            images: ['/og-image.png'],
        });
        expect(
            'images' in buildTwitterMetadata({ title: 't', description: 'd' })
        ).toBe(false);
    });

    it('핸들이 X_URL 계정과 같다', () => {
        expect(X_URL).toBe(`https://x.com/${X_HANDLE.slice(1)}`);
    });
});
