/**
 * 산문 게이트의 경계. 두 빌더(주식·크립토)가 같은 판정기를 공유하므로,
 * 키 형식이나 "집합 없음 = 필터 끔" 규칙이 어긋나면 sitemap 두 개가 동시에
 * 틀린다 — 빌더 테스트를 통한 간접 확인 말고 여기서 직접 못 박는다.
 */
import {
    PROSE_GATED_SITEMAP_TABS,
    makeProseGate,
    makeSnapshotTimeLookup,
    snapshotKey,
} from '../lib/proseGate';

const AT = new Date('2026-10-03T02:00:00.000Z');

describe('makeProseGate', () => {
    it('게이트 대상 탭은 차트(technical)·뉴스(news)다 — overall·congress는 항상 noindex라 빠졌다', () => {
        expect([...PROSE_GATED_SITEMAP_TABS]).toEqual(['technical', 'news']);
    });

    it('집합이 없으면(로더 실패) 모든 조합을 통과시킨다 — sitemap이 통째로 비는 쪽이 더 나쁘다', () => {
        const hasProse = makeProseGate({});

        for (const tab of PROSE_GATED_SITEMAP_TABS) {
            expect(hasProse('AAPL', tab)).toBe(true);
        }
    });

    it('집합에 든 "SYMBOL:tab" 조합만 통과시킨다', () => {
        const hasProse = makeProseGate({
            snapshotGeneratedAt: new Map([['AAPL:news', AT]]),
        });

        expect(hasProse('AAPL', 'news')).toBe(true);
        // 다른 종목의 같은 탭은 막힌다.
        expect(hasProse('MSFT', 'news')).toBe(false);
    });

    it('빈 집합은 전부 막는다 — `undefined`(필터 끔)와 구분된다', () => {
        const hasProse = makeProseGate({ snapshotGeneratedAt: new Map() });

        expect(hasProse('AAPL', 'news')).toBe(false);
    });

    it('키는 대소문자·구분자를 그대로 본다 — 티커 표기가 어긋나면 막힌다', () => {
        const hasProse = makeProseGate({
            snapshotGeneratedAt: new Map([['AAPL:news', AT]]),
        });

        expect(hasProse('aapl', 'news')).toBe(false);
        expect(hasProse('AAPL:news', 'news')).toBe(false);
    });
});

describe('탭별 독립 판정', () => {
    it('technical 키만 있는 종목은 news 게이트를 통과하지 못하고, 그 반대도 같다', () => {
        const technicalOnly = makeProseGate({
            snapshotGeneratedAt: new Map([['AAPL:technical', AT]]),
        });
        const newsOnly = makeProseGate({
            snapshotGeneratedAt: new Map([['AAPL:news', AT]]),
        });

        expect(technicalOnly('AAPL', 'technical')).toBe(true);
        expect(technicalOnly('AAPL', 'news')).toBe(false);
        expect(newsOnly('AAPL', 'news')).toBe(true);
        expect(newsOnly('AAPL', 'technical')).toBe(false);
    });
});

describe('makeSnapshotTimeLookup', () => {
    it('"SYMBOL:tab" 키로 generatedAt을 돌려준다', () => {
        const timeOf = makeSnapshotTimeLookup({
            snapshotGeneratedAt: new Map([[snapshotKey('AAPL', 'news'), AT]]),
        });

        expect(timeOf('AAPL', 'news')).toBe(AT);
        expect(timeOf('AAPL', 'technical')).toBeUndefined();
        expect(timeOf('MSFT', 'news')).toBeUndefined();
    });

    it('맵이 없으면(로더 실패) 항상 undefined — 호출 빌더가 폴백을 쓴다', () => {
        const timeOf = makeSnapshotTimeLookup({});

        expect(timeOf('AAPL', 'news')).toBeUndefined();
    });
});
