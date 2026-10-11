import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetIntlFormatCacheForTests } from '@/shared/lib/intlFormatCache';
import {
    formatCompactAmount,
    formatCompactCurrency,
    formatCurrencyForSymbol,
} from '@/shared/lib/priceFormat';

/**
 * 구버전 엔진(Chrome ≤130 — 네이버 앱 웹뷰 128, 삼성 인터넷 28)의 Intl 동작을 흉내 낸다.
 * Chrome for Testing 128·130에서 실측한 두 가지 차이다.
 *
 * 1. 최소 소수 자릿수를 생략하면 통화 기본값(USD 2)을 최대값으로 깎아 쓴다 —
 *    `maximumFractionDigits: 1`이면 최소도 1이 되어 `US$3152.0만`이 나온다.
 *    서버(Node 24)와 최신 브라우저는 compact 기본 최소 0이라 `US$3152만`이다.
 * 2. zh CLDR의 원화 기호가 `currencyDisplay: 'symbol'`일 때 전각 `￦`이다.
 *
 * 서버 렌더와 이 출력이 다르면 하이드레이션이 React #418로 깨진다. Node만으로는 두
 * 차이가 드러나지 않아(수정 전후 출력이 같다) 래퍼로 재현해 단언한다.
 *
 * 이 래퍼는 실측을 손으로 옮긴 것이라 실제 엔진과 어긋나면 테스트가 조용히 무의미해진다
 * (TESTING.md#TE-52). 지원 하한 엔진을 바꾸거나 이 동작을 다시 의심할 때는 실제 엔진으로
 * 재확인한다: `npx @puppeteer/browsers install chrome@128`로 받은 바이너리를 Playwright
 * `chromium.launch({ executablePath })`로 띄워 같은 옵션의 `Intl.NumberFormat` 출력을 본다.
 */
const RealNumberFormat = Intl.NumberFormat;
const CURRENCY_DEFAULT_DIGITS: Record<string, number> = { USD: 2, KRW: 0 };

function OldEngineNumberFormat(
    locale?: string | string[],
    options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
    const adjusted = { ...options };
    if (
        adjusted.style === 'currency' &&
        adjusted.minimumFractionDigits === undefined &&
        adjusted.maximumFractionDigits !== undefined
    ) {
        adjusted.minimumFractionDigits = Math.min(
            CURRENCY_DEFAULT_DIGITS[adjusted.currency ?? 'USD'] ?? 2,
            adjusted.maximumFractionDigits
        );
    }
    const real = new RealNumberFormat(locale, adjusted);
    const fullWidthWon =
        String(locale).startsWith('zh') &&
        adjusted.currency === 'KRW' &&
        (adjusted.currencyDisplay ?? 'symbol') === 'symbol';
    return {
        ...real,
        resolvedOptions: () => real.resolvedOptions(),
        formatToParts: (value: number | bigint) => real.formatToParts(value),
        format: (value: number | bigint) => {
            const out = real.format(value);
            return fullWidthWon ? out.replace('₩', '￦') : out;
        },
    } as Intl.NumberFormat;
}

describe('priceFormat — 구버전 엔진과 서버 출력 일치', () => {
    // 포매터 캐시가 모듈 스코프라, 스텁 전후로 비워야 진짜 Intl로 만든 인스턴스가 섞이지 않는다.
    beforeEach(() => {
        __resetIntlFormatCacheForTests();
        vi.stubGlobal('Intl', {
            ...Intl,
            NumberFormat: OldEngineNumberFormat,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        __resetIntlFormatCacheForTests();
    });

    it.each([
        ['ko', 31_520_000, 'US$3152만'],
        ['ko', 195_200_000_000, 'US$1952억'],
        ['en', 109_000_000_000, '$109B'],
        ['ja', 31_520_000, '$3152万'],
        ['zh', 31_520_000, 'US$3152万'],
    ] as const)(
        '%s: 정수로 떨어지는 compact 달러에 .0을 붙이지 않는다 (%d)',
        (locale, value, expected) => {
            expect(formatCompactAmount(value, 'USD', locale)).toBe(expected);
        }
    );

    it('소수 한 자리가 있는 값은 그대로 한 자리를 남긴다', () => {
        expect(formatCompactAmount(3_500_000_000_000, 'USD', 'ko')).toBe(
            'US$3.5조'
        );
    });

    it('zh 원화 compact는 반각 ₩을 쓴다', () => {
        expect(
            formatCompactCurrency(196_700_000_000_000, '005930.KS', 'zh')
        ).toBe('₩196.7万亿');
    });

    it('zh 원화 비축약 금액도 반각 ₩을 쓴다', () => {
        expect(formatCurrencyForSymbol(274_500, '005930.KS', 'zh')).toBe(
            '₩274,500'
        );
    });

    // 구버전 동작과 무관하게 수정 전에도 통과하는 케이스다. 지키는 것은 `currencyDisplayFor`의
    // 분기 — 원화의 narrowSymbol을 달러까지 넓히면 ko의 `US$`가 `$`로 바뀌는 회귀를 잡는다.
    it('ko 달러는 narrowSymbol로 바뀌지 않고 US$를 유지한다', () => {
        expect(formatCompactCurrency(4_500_000_000_000, 'AAPL', 'ko')).toBe(
            'US$4.5조'
        );
    });
});
