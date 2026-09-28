import { describe, expect, it } from 'vitest';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';

describe('hashUrlToId', () => {
    it('returns a string of exactly 32 characters', () => {
        const id = hashUrlToId('https://example.com/article/1');
        expect(id).toHaveLength(32);
    });

    it('is deterministic for the same URL', () => {
        const url = 'https://news.example.com/aapl-earnings-2024';
        expect(hashUrlToId(url)).toBe(hashUrlToId(url));
    });

    it('produces different IDs for different URLs', () => {
        expect(hashUrlToId('https://a.com/1')).not.toBe(
            hashUrlToId('https://b.com/2')
        );
    });

    it('produces different IDs for same-domain URLs (regression: base64-truncation collision)', () => {
        // 같은 도메인 URL들의 앞 24바이트가 동일해도 반드시 다른 ID를 생성해야 한다.
        // 이전 구현(Buffer.from(url).toString('base64url').slice(0,32))은 앞 24바이트에만
        // 의존해 동일 도메인 기사 전체가 같은 ID를 가지는 버그가 있었다.
        const url1 =
            'https://www.globenewswire.com/news-release/2026/05/07/3290250/0/en/SEALSQ-article-1.html';
        const url2 =
            'https://www.globenewswire.com/news-release/2026/04/30/3285542/0/en/WISeKey-article-2.html';
        expect(hashUrlToId(url1)).not.toBe(hashUrlToId(url2));

        const url3 =
            'https://seekingalpha.com/article/4895552-sealsq-quantum-setup.html';
        const url4 =
            'https://seekingalpha.com/article/1234567-tesla-cybertruck.html';
        expect(hashUrlToId(url3)).not.toBe(hashUrlToId(url4));
    });

    it('contains only base64url-safe characters', () => {
        const id = hashUrlToId('https://example.com/some-article?q=value&x=1');
        expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
});
