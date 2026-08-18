import { describe, expect, it } from 'vitest';
import {
    formatCompactCurrency,
    formatSignedAmount,
} from '@/shared/lib/priceFormat';

/**
 * 프로덕션 실측에서 잡힌 결함의 회귀 가드다. 국내 상장 종목의 펀더멘털·뉴스 탭이
 * 원화 금액에 `US$`를 붙이고 있었다 — `시가총액 US$1802.5조`, `목표 주가 US$450,000`.
 * 같은 사이트가 차트 탭에서는 같은 값을 `₩274,500`으로 쓴다. 색인된 금융 정보라
 * 표기 오류의 대가가 크다.
 */
describe('formatCompactCurrency', () => {
    it('국내 상장 종목은 원화 기호를 쓴다', () => {
        const out = formatCompactCurrency(1_802_500_000_000_000, '005930.KS');
        expect(out).toContain('₩');
        expect(out).not.toContain('US$');
    });

    it('코스닥 종목도 마찬가지다', () => {
        expect(formatCompactCurrency(1_000_000_000, '247540.KQ')).toContain(
            '₩'
        );
    });

    it('미국 종목은 종전대로 달러다', () => {
        const out = formatCompactCurrency(4_500_000_000_000, 'AAPL');
        expect(out).toContain('$');
        expect(out).not.toContain('₩');
    });

    it('크립토도 달러다 — 국내 종목 형상이 아니다', () => {
        expect(formatCompactCurrency(1_000_000_000, 'BTCUSD')).not.toContain(
            '₩'
        );
    });

    it('소문자 심볼도 국내 종목으로 인식한다', () => {
        expect(formatCompactCurrency(1_000, '005930.ks')).toContain('₩');
    });
});

/**
 * `formatSignedUsd`의 통화-인지 counterpart. PositionStatusSummary가
 * 평가손익(unrealizedPnl)에 하드코딩된 `$`를 쓰던 결함(SEO/표기 감사)의 회귀
 * 가드다 — 원화 종목은 소수점 없이 `₩` 부호를, 그 외에는 `formatSignedUsd`와
 * 동일한 dynamic-by-magnitude 출력을 낸다.
 */
describe('formatSignedAmount', () => {
    it('국내 상장 종목은 소수점 없이 ₩ 부호를 붙인다', () => {
        expect(formatSignedAmount(1_250_000, '005930.KS')).toBe('+₩1,250,000');
    });

    it('국내 상장 종목의 음수 값도 ₩ 부호를 유지한다', () => {
        expect(formatSignedAmount(-1_250_000, '005930.KS')).toBe('-₩1,250,000');
    });

    it('국내 상장 종목의 0은 +₩0이다', () => {
        expect(formatSignedAmount(0, '005930.KS')).toBe('+₩0');
    });

    it('미국 종목은 formatSignedUsd와 동일하게 $ 표기를 쓴다', () => {
        expect(formatSignedAmount(300, 'AAPL')).toBe('+$300.00');
        expect(formatSignedAmount(-150, 'AAPL')).toBe('-$150.00');
    });

    it('크립토도 $ 표기다 — 국내 종목 형상이 아니다', () => {
        expect(formatSignedAmount(0.1, 'BTCUSD')).toBe('+$0.10000');
    });
});
