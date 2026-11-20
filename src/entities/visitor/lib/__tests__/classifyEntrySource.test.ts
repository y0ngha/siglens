import { describe, expect, it } from 'vitest';
import { ENTRY_SOURCES } from '../../types';
import { classifyEntrySource } from '../classifyEntrySource';

const OWN = 'siglens.io';

interface Extra {
    utmMedium?: string | null;
    adClick?: boolean;
    landingPath?: string | null;
}

function classify(
    referrerHost: string | null,
    utmSource: string | null = null,
    extra: Extra = {}
) {
    return classifyEntrySource({
        referrerHost,
        utmSource,
        utmMedium: extra.utmMedium ?? null,
        adClick: extra.adClick ?? false,
        landingPath: extra.landingPath ?? null,
        ownHost: OWN,
    });
}

describe('classifyEntrySource', () => {
    it.each([
        ['chatgpt.com', 'chatgpt'],
        ['chat.openai.com', 'chatgpt'],
        ['www.perplexity.ai', 'perplexity'],
        ['gemini.google.com', 'gemini'],
        ['copilot.microsoft.com', 'copilot'],
        ['claude.ai', 'claude'],
        ['www.google.com', 'google'],
        ['www.google.co.kr', 'google'],
        ['m.search.naver.com', 'naver'],
        ['blog.naver.com', 'naver-blog'],
        ['m.blog.naver.com', 'naver-blog'],
        ['search.daum.net', 'daum'],
        ['www.bing.com', 'bing'],
        ['t.co', 'x'],
        ['www.threads.com', 'threads'],
        ['news.ycombinator.com', 'other'],
        ['www.naver.com', 'naver'],
        ['finance.naver.com', 'naver-finance'],
        ['m.stock.naver.com', 'naver-finance'],
        ['com.google.android.googlequicksearchbox', 'google'],
        ['com.nhn.android.search', 'naver'],
    ] as const)('%s → %s', (host, expected) => {
        expect(classify(host)).toBe(expected);
    });

    it('알려진 utm_source가 Referer보다 먼저다(앱 내 브라우저는 Referer를 비운다)', () => {
        expect(classify(null, 'chatgpt.com')).toBe('chatgpt');
        expect(classify('www.google.com', 'Perplexity')).toBe('perplexity');
    });

    it('모르는 utm_source는 저장하지 않고 Referer로 판단한다', () => {
        expect(classify('www.bing.com', 'my-newsletter-2026')).toBe('bing');
        expect(classify(null, 'my-newsletter-2026')).toBeNull();
        // 프로토타입 키를 분류값으로 착각하지 않는다.
        expect(classify(null, 'constructor')).toBeNull();
    });

    it('같은 사이트(서브도메인 포함) 이동과 직접 방문은 출처가 없다', () => {
        expect(classify('siglens.io')).toBeNull();
        expect(classify('ai.siglens.io')).toBeNull();
        expect(classify(null)).toBeNull();
        expect(classify('')).toBeNull();
    });

    it('포털의 검색 외 서비스(뉴스·메일·증권)는 검색엔진으로 세지 않는다', () => {
        expect(classify('news.naver.com')).toBe('other');
        expect(classify('finance.daum.net')).toBe('other');
        expect(classify('news.google.com')).toBe('other');
        expect(classify('mail.google.com')).toBe('other');
    });

    it('google을 흉내 낸 다른 도메인은 google이 아니다', () => {
        expect(classify('google.com.evil.example')).toBe('other');
        expect(classify('notgoogle.com')).toBe('other');
    });

    it('결과는 항상 ENTRY_SOURCES 안의 값이거나 null이다', () => {
        for (const host of [
            'chatgpt.com',
            'x.com',
            'example.org',
            'siglens.io',
        ]) {
            const result = classify(host);
            expect(
                result === null ||
                    (ENTRY_SOURCES as readonly string[]).includes(result)
            ).toBe(true);
        }
    });

    describe('광고·메일·공유 링크 (우선순위 1~3)', () => {
        it('광고 클릭 식별자가 있으면 구글 Referer여도 paid다', () => {
            expect(classify('www.google.com', null, { adClick: true })).toBe(
                'paid'
            );
        });

        it('광고 클릭 식별자는 같은 사이트 Referer에도 적용된다', () => {
            expect(classify('siglens.io', null, { adClick: true })).toBe(
                'paid'
            );
        });

        it.each([
            'cpc',
            'ppc',
            'paid',
            'paid_search',
            'paid_social',
            'display',
            'cpm',
            ' CPC ',
        ])('utm_medium=%s는 paid다', medium => {
            expect(classify(null, null, { utmMedium: medium })).toBe('paid');
        });

        it('utm_source=naver가 유료 매체와 함께 오면 paid가 이긴다', () => {
            expect(classify(null, 'naver', { utmMedium: 'cpc' })).toBe('paid');
        });

        it('광고 클릭 식별자와 utm_source=email이 같이 있으면 paid가 이긴다', () => {
            expect(classify(null, 'email', { adClick: true })).toBe('paid');
        });

        it('모르는 utm_medium은 무시한다', () => {
            expect(
                classify(null, null, { utmMedium: 'newsletter' })
            ).toBeNull();
            expect(classify('www.bing.com', null, { utmMedium: 'x' })).toBe(
                'bing'
            );
        });

        it('utm_source=email은 email이다', () => {
            expect(classify(null, 'email')).toBe('email');
        });

        it('utm_medium=email만 있어도 email이다', () => {
            expect(
                classify('mail.google.com', null, { utmMedium: 'email' })
            ).toBe('email');
        });

        it('공유 링크 페이지는 로케일 접두사 유무와 상관없이 share다', () => {
            expect(classify(null, null, { landingPath: '/share/abc' })).toBe(
                'share'
            );
            expect(
                classify(null, null, { landingPath: '/en/share/abc/' })
            ).toBe('share');
        });

        it('공유 링크 페이지는 외부 Referer보다 먼저다', () => {
            expect(classify('t.co', null, { landingPath: '/share/x' })).toBe(
                'share'
            );
        });

        it('공유 링크 페이지는 같은 사이트 Referer에도 적용된다', () => {
            expect(
                classify('siglens.io', null, { landingPath: '/ko/share/x' })
            ).toBe('share');
        });

        it('공유 링크 페이지와 utm_source=email이 같이 있으면 email이 이긴다', () => {
            expect(classify(null, 'email', { landingPath: '/share/x' })).toBe(
                'email'
            );
        });

        it.each([
            '/share',
            '/share/a/b',
            '/xshare/a',
            '/en/sharex/a',
            '/fr/share/a',
        ])('공유 링크가 아닌 경로 %s는 share가 아니다', landingPath => {
            expect(classify(null, null, { landingPath })).toBeNull();
        });
    });
});
