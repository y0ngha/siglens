import { describe, expect, it } from 'vitest';
import { collapseLandingPath } from '@/app/api/presence/_shared/collapseLandingPath';

describe('collapseLandingPath', () => {
    it.each([
        ['/share/abc123', '/share/:id'],
        ['/share/abc123/', '/share/:id'],
        ['/en/share/abc123', '/en/share/:id'],
        ['/ja/share/abc123/extra', '/ja/share/:id'],
    ])('메인 호스트의 공유 경로 %s는 %s로 접는다', (path, expected) => {
        expect(collapseLandingPath(path, 'main')).toBe(expected);
    });

    it.each([
        ['/c/9f1d-conv', '/c/:id'],
        ['/zh/c/9f1d-conv', '/zh/c/:id'],
    ])('ai 호스트의 대화 경로 %s는 %s로 접는다', (path, expected) => {
        expect(collapseLandingPath(path, 'ai')).toBe(expected);
    });

    it('/c/…는 메인 호스트에서 접지 않는다(종목 C의 탭일 수 있다)', () => {
        expect(collapseLandingPath('/c/news', 'main')).toBe('/c/news');
    });

    it('/share/…는 ai 호스트에서 접지 않는다', () => {
        expect(collapseLandingPath('/share/abc', 'ai')).toBe('/share/abc');
    });

    it.each([
        '/',
        '/AAPL',
        '/ko/AAPL/news',
        '/guide/howto/rsi',
        '/share',
        '/sharex/a',
        '/lp/stock-analysis',
    ])('식별자가 아닌 경로 %s는 그대로 둔다', path => {
        expect(collapseLandingPath(path, 'main')).toBe(path);
    });

    it('경로나 사이트를 모르면 입력 그대로다', () => {
        expect(collapseLandingPath(null, 'main')).toBeNull();
        expect(collapseLandingPath('/share/abc', null)).toBe('/share/abc');
    });
});
