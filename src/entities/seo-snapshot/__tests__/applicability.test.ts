import { describe, expect, it } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    applicableTabsFor,
    buildPrewarmUniverse,
    isPrewarmTab,
    PREWARM_TABS,
    prewarmSessionSpecFor,
} from '../lib/applicability';

describe('applicableTabsFor', () => {
    // 2026-10-01: 프리웜은 자산군과 무관하게 차트·뉴스 두 탭만 굽는다
    // (`PREWARM_TABS` JSDoc). 나머지 탭은 페이지가 항상 noindex다.
    it('크립토는 technical/news', () => {
        expect(applicableTabsFor(POPULAR_CRYPTOS[0])).toEqual([
            'technical',
            'news',
        ]);
    });

    it('옵션 상장 미국 주식도 technical/news만 (options·overall 등 제외)', () => {
        expect(applicableTabsFor('AAPL')).toEqual(['technical', 'news']);
    });

    it('한국 종목도 technical/news만', () => {
        expect(applicableTabsFor('005930.KS')).toEqual(['technical', 'news']);
    });

    it('화이트리스트 밖 심볼은 빈 배열', () => {
        expect(applicableTabsFor('ZZZQ_NOT_REAL')).toEqual([]);
    });

    it('소문자 입력도 정규화 처리', () => {
        expect(applicableTabsFor('aapl')).toEqual(['technical', 'news']);
    });

    it('반환 배열은 호출마다 새 배열이다 (상수 오염 방지)', () => {
        const tabs = applicableTabsFor('AAPL');
        tabs.push('overall');
        expect(applicableTabsFor('AAPL')).toEqual([...PREWARM_TABS]);
    });
});

describe('isPrewarmTab', () => {
    it('technical·news만 참이다', () => {
        expect(isPrewarmTab('technical')).toBe(true);
        expect(isPrewarmTab('news')).toBe(true);
        for (const tab of [
            'overall',
            'fundamental',
            'financials',
            'congress',
            'options',
        ] as const) {
            expect(isPrewarmTab(tab)).toBe(false);
        }
    });
});

describe('buildPrewarmUniverse', () => {
    // 실패 시 상수 목록 변경 — 아래 수치도 함께 갱신.
    //
    // ⚠️ 이 수치는 장식이 아니라 **용량 게이트**다. 야간 처리량은 틱 약 90회 ×
    // SYMBOLS_PER_TICK 6 ≈ 540 심볼-슬롯이다. 유니버스를 키우기 전에
    // `[seo-prewarm] batch done`의 `remaining`이 매일 밤 0으로 수렴하는지 먼저 본다.
    //
    // 2026-10-01: C 구간 43종 제거(391 → 348) + 탭을 2개로 축소 → 377 × 2 = 754.
    // (직전 2742 유닛 대비 약 72% 감소.)
    it('전체 유닛 수 = 377 × 2 = 754', () => {
        const units = buildPrewarmUniverse().reduce(
            (n, u) => n + u.tabs.length,
            0
        );
        expect(units).toBe(754);
    });

    // 실패 시 상수 목록 변경 — 위 수치도 함께 갱신
    it('심볼 수 = 377 (POPULAR_TICKERS 348 + POPULAR_CRYPTOS 29)', () => {
        expect(buildPrewarmUniverse()).toHaveLength(377);
    });
});

/**
 * 세션 스펙 해석이 **세 자산군 전부**를 구분하는지 못박는다.
 *
 * 처음 구현은 `isKrEquitySymbol(s) ? KR : US` 2분기였고, 그 결과 크립토가 미국 주식으로
 * 분류됐다. prewarm 창은 UTC 고정이라 EST 기간(11~3월)에는 시작 20:30 UTC가 NYSE 마감
 * (21:00 UTC)보다 이르고, 그 30분 동안 장중 게이트가 크립토를 **매일 밤 배치에서
 * 조용히 빼고 있었다**.
 */
describe('prewarmSessionSpecFor', () => {
    it('크립토는 always-open 스펙을 받는다', () => {
        expect(prewarmSessionSpecFor('BTCUSD')).toBe(CRYPTO_SESSION);
    });

    it('국내 종목은 KRX 스펙을 받는다', () => {
        expect(prewarmSessionSpecFor('005930.KS')).toBe(KR_EQUITY_SESSION);
        expect(prewarmSessionSpecFor('247540.KQ')).toBe(KR_EQUITY_SESSION);
    });

    it('미국 종목은 NYSE 스펙을 받는다', () => {
        expect(prewarmSessionSpecFor('AAPL')).toBe(US_EQUITY_SESSION);
    });

    it('소문자 입력도 같은 스펙으로 해석한다', () => {
        expect(prewarmSessionSpecFor('btcusd')).toBe(CRYPTO_SESSION);
        expect(prewarmSessionSpecFor('005930.ks')).toBe(KR_EQUITY_SESSION);
    });

    it('화이트리스트 밖 심볼은 미국 주식으로 떨어진다', () => {
        // prewarm 유니버스에는 들어오지 않지만, 방어적 기본값이 무엇인지 못박아 둔다.
        expect(prewarmSessionSpecFor('ZZZZ')).toBe(US_EQUITY_SESSION);
    });

    it('모든 크립토 심볼이 예외 없이 always-open이다', () => {
        for (const symbol of POPULAR_CRYPTOS) {
            expect(prewarmSessionSpecFor(symbol)).toBe(CRYPTO_SESSION);
        }
    });
});
