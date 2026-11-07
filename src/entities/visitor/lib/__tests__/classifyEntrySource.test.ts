import { describe, expect, it } from 'vitest';
import { ENTRY_SOURCES } from '../../types';
import { classifyEntrySource } from '../classifyEntrySource';

const OWN = 'siglens.io';

function classify(
    referrerHost: string | null,
    utmSource: string | null = null
) {
    return classifyEntrySource({ referrerHost, utmSource, ownHost: OWN });
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
});
