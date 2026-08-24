import { describe, expect, it } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    applicableTabsFor,
    buildPrewarmUniverse,
    prewarmSessionSpecFor,
} from '../lib/applicability';

describe('applicableTabsFor', () => {
    it('크립토는 technical/overall/news만', () => {
        expect(applicableTabsFor(POPULAR_CRYPTOS[0])).toEqual([
            'technical',
            'overall',
            'news',
        ]);
    });

    it('옵션 상장 주식은 7탭 전부 (options 포함)', () => {
        expect(applicableTabsFor('AAPL')).toHaveLength(7);
        expect(applicableTabsFor('AAPL')).toContain('options');
    });

    it('옵션 미상장 주식(TCEHY)은 options 제외 6탭', () => {
        expect(applicableTabsFor('TCEHY')).toHaveLength(6);
        expect(applicableTabsFor('TCEHY')).not.toContain('options');
    });

    it('화이트리스트 밖 심볼은 빈 배열', () => {
        expect(applicableTabsFor('ZZZQ_NOT_REAL')).toEqual([]);
    });

    it('소문자 입력도 정규화 처리', () => {
        expect(applicableTabsFor('aapl')).toHaveLength(7);
    });
});

describe('buildPrewarmUniverse', () => {
    // 실패 시 상수 목록 변경 — 스펙 §5 수치도 함께 갱신.
    // SEO 감사 라운드 2에서 SPCX/SKHY를 POPULAR_TICKERS에서 뺀 만큼(옵션 상장
    // US 주식 7탭 버킷에서 2종목) 264→262, 2041→2027로 갱신됐다.
    // 2026-08-24: `/market` 섹터 허브가 링크하던 23종(SPDR 섹터 ETF 11 + S&P 대형주
    // 12)을 POPULAR_TICKERS에 넣으면서 6탭 버킷이 1→24가 됐다(옵션 미상장이라 7탭이
    // 아니다). 2027 + 23×6 = 2165. 야간 처리량 여유 확인용 수치이므로 함께 본다:
    // 틱 ~90 × SYMBOLS_PER_TICK 6 ≈ 540 심볼-슬롯 / 밤, 유니버스 335.
    it('전체 유닛 수 = 262×7 + 24×6 + 20×5 + 29×3 = 2165 (spec §5 실측)', () => {
        const units = buildPrewarmUniverse().reduce(
            (n, u) => n + u.tabs.length,
            0
        );
        expect(units).toBe(2165);
    });

    // 실패 시 상수 목록 변경 — 스펙 §5 수치도 함께 갱신
    it('심볼 수 = 335 (POPULAR_TICKERS 306 + POPULAR_CRYPTOS 29)', () => {
        expect(buildPrewarmUniverse()).toHaveLength(335);
    });

    it('한국 종목은 options·congress를 prewarm하지 않는다', () => {
        // 국내에는 개별주식옵션 시장도 공직자 매매 공시 API도 없다 —
        // KR_EQUITY_DESCRIPTOR.tabs와 같은 이유로 제외된다.
        const tabs = applicableTabsFor('005930.KS');
        expect(tabs).not.toContain('options');
        expect(tabs).not.toContain('congress');
        expect(tabs).toEqual([
            'technical',
            'overall',
            'fundamental',
            'financials',
            'news',
        ]);
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
