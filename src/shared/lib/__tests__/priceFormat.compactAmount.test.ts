import { describe, it, expect } from 'vitest';
import { formatCompactAmount } from '@/shared/lib/priceFormat';

describe('formatCompactAmount', () => {
    it('formats USD in the en-US compact scale', () => {
        expect(formatCompactAmount(5_000_000_000, 'USD', 'en')).toBe('$5B');
        expect(formatCompactAmount(340_000_000, 'USD', 'en')).toBe('$340M');
    });

    it('formats KRW in the Korean compact scale, not the western one', () => {
        // 로케일을 통화에 묶지 않으면 333조가 `₩333T`로 나와 한국 사용자에게 읽히지 않는다.
        const formatted = formatCompactAmount(333_605_938_000_000, 'KRW', 'ko');
        expect(formatted).toContain('조');
        expect(formatted).not.toContain('T');
    });

    it('renders the exact KRW string, including the ₩ glyph (guards against currency mixups)', () => {
        expect(formatCompactAmount(333_605_938_000_000, 'KRW', 'ko')).toBe(
            '₩333.6조'
        );
    });

    it('renders the exact USD string as a counterpart to the KRW pin', () => {
        expect(formatCompactAmount(333_605_938_000_000, 'USD', 'en')).toBe(
            '$333.6T'
        );
    });

    it('renders KRW without decimal sub-units', () => {
        expect(formatCompactAmount(274_500, 'KRW', 'ko')).not.toContain('.00');
    });

    it('keeps the sign for negative amounts (net cash, capex)', () => {
        expect(
            formatCompactAmount(-100_607_975_000_000, 'KRW', 'ko')
        ).toContain('-');
    });
});

/**
 * compact 표기는 **로케일 단위 체계**를 쓴다. 포매터가 통화별로 `en-US`/`ko-KR`에
 * 묶여 있어서 `/en/AAPL/fundamental`이 `US$4.7조`를, ko 사용자는 이벤트
 * 캘린더에서 `₩333T`를 봤다 — 서로 반대 방향으로 틀린 같은 결함이다.
 */
describe('formatCompactAmount — 로케일 단위', () => {
    const T = 4_700_000_000_000;

    it('ko는 한국어 단위를 쓴다', () => {
        expect(formatCompactAmount(T, 'USD', 'ko')).toContain('조');
    });

    it.each(['en', 'ja', 'zh'] as const)('%s에는 한글이 없다', locale => {
        expect(formatCompactAmount(T, 'USD', locale)).not.toMatch(/[가-힣]/);
        expect(formatCompactAmount(T, 'KRW', locale)).not.toMatch(/[가-힣]/);
    });

    it('원화도 로케일을 따른다 — ko에 T가 나오지 않는다', () => {
        // `en-US` 고정이면 `₩333T`가 되어 한국 사용자에게 읽히지 않는다.
        expect(formatCompactAmount(T, 'KRW', 'ko')).toContain('조');
    });
});
