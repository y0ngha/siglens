import { describe, expect, it } from 'vitest';
import { collectFacts, collectNumbers } from '../lib/collectFacts';

describe('collectNumbers', () => {
    it('중첩 객체와 배열을 훑어 숫자를 전부 모은다', () => {
        const got = collectNumbers({
            a: 1,
            b: { c: 2.5, d: [3, { e: 4 }] },
            f: 'skip',
        });
        expect([...got].sort((x, y) => x - y)).toEqual([1, 2.5, 3, 4]);
    });

    it('NaN·Infinity는 제외한다 — 프롬프트에 실리면 안 된다', () => {
        expect([...collectNumbers({ a: NaN, b: Infinity, c: 1 })]).toEqual([1]);
    });

    it('null을 만나도 던지지 않는다', () => {
        expect([...collectNumbers({ a: null, b: [null, 7] })]).toEqual([7]);
    });
});

describe('collectFacts', () => {
    it('trend·riskLevel이 있으면 싣는다', () => {
        expect(
            collectFacts(
                { trend: 'bullish', riskLevel: 'medium', p: 10 },
                'AAPL'
            )
        ).toEqual({
            symbol: 'AAPL',
            trend: 'bullish',
            riskLevel: 'medium',
            numbers: [10],
        });
    });

    /**
     * `news`·`congress` 응답에는 두 필드가 없다. 이 레이어는 7종 분석에 공통으로
     * 쓰이므로 특정 타입의 필드를 전제하면 안 된다.
     */
    it('없는 필드는 키 자체를 만들지 않는다', () => {
        expect(collectFacts({ headlineKo: '…' }, 'GOOG')).toEqual({
            symbol: 'GOOG',
            numbers: [],
        });
    });

    it('숫자를 오름차순으로 정렬한다', () => {
        expect(collectFacts({ a: 9, b: 1, c: 5 }, 'X').numbers).toEqual([
            1, 5, 9,
        ]);
    });

    it('분석이 객체가 아니어도 던지지 않는다', () => {
        expect(collectFacts(null, 'X')).toEqual({ symbol: 'X', numbers: [] });
    });
});

describe('collectFacts — 통화', () => {
    /**
     * 회귀: 통화가 빠지면 모델이 `421.46`처럼 단위 없는 맨 숫자를 쓴다. 원본 분석문이
     * `MA20 421.46`처럼 지표명 뒤에 단위 없는 숫자를 쓰는데, 지표명을 지우라고 하면
     * 숫자만 남기 때문이다(49건 실측: 0.47 → 0.14개/건으로 개선).
     */
    it('USD를 달러 표기로 바꿔 싣는다', () => {
        expect(collectFacts({ p: 1 }, 'AAPL', 'USD').currency).toBe('달러');
    });

    it('KRW를 원 표기로 바꿔 싣는다', () => {
        expect(collectFacts({ p: 1 }, '005380.KS', 'KRW').currency).toBe('원');
    });

    it('생략하면 키 자체를 만들지 않는다', () => {
        expect(collectFacts({ p: 1 }, 'AAPL')).not.toHaveProperty('currency');
    });
});
