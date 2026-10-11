import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function loadPriceFormat() {
    vi.resetModules();
    return import('@/shared/lib/priceFormat');
}

describe('priceFormat — 구버전 엔진과 서버 출력 일치', () => {
    beforeEach(() => {
        vi.stubGlobal('Intl', {
            ...Intl,
            NumberFormat: OldEngineNumberFormat,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['ko', 31_520_000, 'US$3152만'],
        ['ko', 195_200_000_000, 'US$1952억'],
        ['en', 109_000_000_000, '$109B'],
        ['ja', 31_520_000, '$3152万'],
        ['zh', 31_520_000, 'US$3152万'],
    ] as const)(
        '%s: 정수로 떨어지는 compact 달러에 .0을 붙이지 않는다 (%d)',
        async (locale, value, expected) => {
            const { formatCompactAmount } = await loadPriceFormat();
            expect(formatCompactAmount(value, 'USD', locale)).toBe(expected);
        }
    );

    it('소수 한 자리가 있는 값은 그대로 한 자리를 남긴다', async () => {
        const { formatCompactAmount } = await loadPriceFormat();
        expect(formatCompactAmount(3_500_000_000_000, 'USD', 'ko')).toBe(
            'US$3.5조'
        );
    });

    it('zh 원화 compact는 반각 ₩을 쓴다', async () => {
        const { formatCompactCurrency } = await loadPriceFormat();
        expect(
            formatCompactCurrency(196_700_000_000_000, '005930.KS', 'zh')
        ).toBe('₩196.7万亿');
    });

    it('zh 원화 비축약 금액도 반각 ₩을 쓴다', async () => {
        const { formatCurrencyForSymbol } = await loadPriceFormat();
        expect(formatCurrencyForSymbol(274_500, '005930.KS', 'zh')).toBe(
            '₩274,500'
        );
    });

    it('ko 달러는 narrowSymbol로 바뀌지 않고 US$를 유지한다', async () => {
        const { formatCompactCurrency } = await loadPriceFormat();
        expect(formatCompactCurrency(4_500_000_000_000, 'AAPL', 'ko')).toBe(
            'US$4.5조'
        );
    });
});
