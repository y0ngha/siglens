/**
 * 산문 게이트의 경계. 두 빌더(주식·크립토)가 같은 판정기를 공유하므로,
 * 키 형식이나 "집합 없음 = 필터 끔" 규칙이 어긋나면 sitemap 두 개가 동시에
 * 틀린다 — 빌더 테스트를 통한 간접 확인 말고 여기서 직접 못 박는다.
 */
import { PROSE_GATED_SITEMAP_TABS, makeProseGate } from '../lib/proseGate';

describe('makeProseGate', () => {
    it('집합이 없으면(로더 실패) 모든 조합을 통과시킨다 — sitemap이 통째로 비는 쪽이 더 나쁘다', () => {
        const hasProse = makeProseGate({});

        for (const tab of PROSE_GATED_SITEMAP_TABS) {
            expect(hasProse('AAPL', tab)).toBe(true);
        }
    });

    it('집합에 든 "SYMBOL:tab" 조합만 통과시킨다', () => {
        const hasProse = makeProseGate({
            symbolTabsWithProse: new Set(['AAPL:overall', 'MSFT:news']),
        });

        expect(hasProse('AAPL', 'overall')).toBe(true);
        expect(hasProse('MSFT', 'news')).toBe(true);
        // 같은 종목의 다른 탭, 다른 종목의 같은 탭 모두 막힌다.
        expect(hasProse('AAPL', 'news')).toBe(false);
        expect(hasProse('MSFT', 'overall')).toBe(false);
        expect(hasProse('AAPL', 'congress')).toBe(false);
    });

    it('빈 집합은 전부 막는다 — `undefined`(필터 끔)와 구분된다', () => {
        const hasProse = makeProseGate({ symbolTabsWithProse: new Set() });

        expect(hasProse('AAPL', 'overall')).toBe(false);
    });

    it('키는 대소문자·구분자를 그대로 본다 — 티커 표기가 어긋나면 막힌다', () => {
        const hasProse = makeProseGate({
            symbolTabsWithProse: new Set(['AAPL:overall']),
        });

        expect(hasProse('aapl', 'overall')).toBe(false);
        expect(hasProse('AAPL:overall', 'overall')).toBe(false);
    });
});
