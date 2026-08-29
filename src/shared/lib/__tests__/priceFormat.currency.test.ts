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
        const out = formatCompactCurrency(
            1_802_500_000_000_000,
            '005930.KS',
            'ko'
        );
        expect(out).toContain('₩');
        expect(out).not.toContain('US$');
    });

    it('코스닥 종목도 마찬가지다', () => {
        expect(
            formatCompactCurrency(1_000_000_000, '247540.KQ', 'ko')
        ).toContain('₩');
    });

    it('미국 종목은 종전대로 달러다', () => {
        const out = formatCompactCurrency(4_500_000_000_000, 'AAPL', 'ko');
        expect(out).toContain('$');
        expect(out).not.toContain('₩');
    });

    it('크립토도 달러다 — 국내 종목 형상이 아니다', () => {
        expect(
            formatCompactCurrency(1_000_000_000, 'BTCUSD', 'ko')
        ).not.toContain('₩');
    });

    it('소문자 심볼도 국내 종목으로 인식한다', () => {
        expect(formatCompactCurrency(1_000, '005930.ks', 'ko')).toContain('₩');
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

    it('국내 상장 종목의 소수 금액도 소수점 없이(원화 호가 관례) 반올림한다 (뮤테이션 감사: maximumFractionDigits 0 → 2 생존자)', () => {
        // unrealizedPnl = (current - avg) * quantity는 회원이 입력한 소수 평단으로
        // 언제든 소수가 될 수 있다. 기존 fixture는 전부 정수라 maximumFractionDigits:0을
        // 2로 바꿔도 그린이 유지됐다 — 소수 입력으로 그 캡을 falsifiable하게 pin한다.
        expect(formatSignedAmount(300.5, '005930.KS')).toBe('+₩301');
        expect(formatSignedAmount(-150.5, '005930.KS')).toBe('-₩151');
    });

    it('미국 종목은 formatSignedUsd와 동일하게 $ 표기를 쓴다', () => {
        expect(formatSignedAmount(300, 'AAPL')).toBe('+$300.00');
        expect(formatSignedAmount(-150, 'AAPL')).toBe('-$150.00');
    });

    it('크립토도 $ 표기다 — 국내 종목 형상이 아니다', () => {
        expect(formatSignedAmount(0.1, 'BTCUSD')).toBe('+$0.10000');
    });
});

/**
 * `notation: 'compact'`는 **로케일 단위 체계**를 쓴다. 포매터가 `'ko-KR'`로
 * 고정돼 있어서 `/en/AAPL`의 시가총액이 `US$3.5조`로 나갔다 — 숫자는 맞고
 * 단위만 한국어인, 눈에 잘 안 띄는 종류의 오류다.
 */
describe('formatCompactCurrency — 로케일 단위', () => {
    const T = 3_500_000_000_000;

    it('ko는 한국어 단위를 쓴다', () => {
        expect(formatCompactCurrency(T, 'AAPL', 'ko')).toContain('조');
    });

    it.each(['en', 'ja', 'zh'] as const)('%s에는 한글이 없다', locale => {
        expect(formatCompactCurrency(T, 'AAPL', locale)).not.toMatch(/[가-힣]/);
    });

    it('로케일마다 실제로 다른 단위를 낸다', () => {
        const all = (['ko', 'en', 'ja', 'zh'] as const).map(l =>
            formatCompactCurrency(T, 'AAPL', l)
        );

        expect(new Set(all).size).toBe(4);
    });
});
