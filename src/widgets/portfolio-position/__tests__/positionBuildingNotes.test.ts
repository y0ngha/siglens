import { describe, expect, it } from 'vitest';

import {
    formatAmount,
    formatAmountAligned,
} from '../lib/positionBuildingNotes';

/**
 * 두 포매터는 **분기 구조가 같고 마지막 한 줄만 다르다**. 그래서 테스트도 같은
 * 케이스 표를 둘에 함께 먹여 갈리는 지점을 눈에 보이게 한다 — 앞의 두 분기
 * (원화·sub-$1)에서는 두 함수가 **바이트 동일**해야 하고, 일반 USD에서만
 * 갈라져야 한다. 한쪽에만 손이 가서 원화가 달라지는 드리프트가 이 대칭을 깬다.
 *
 * 값 하나만 보여주는 자리(빌딩 UI의 층 라벨)는 `$300`이 맞고, 한 문장에 셋이
 * 붙는 자리는 `$300.00`이 맞다 — 근거는 `formatAmountAligned`의 JSDoc.
 */

/** 미국 상장. `currencyForSymbol`이 USD로 판정한다. */
const US = 'AAPL';
/** 한국 상장. `.KS` 접미사로 KRW 판정 — 원화는 소수점을 갖지 않는다. */
const KR = '005930.KS';

describe('formatAmount', () => {
    it('원화는 소수점 없이 천단위 구분만 찍는다', () => {
        expect(formatAmount(274_500, KR)).toBe('₩274,500');
        // 원화에는 sub-1 분기가 없다 — 0.5원은 존재하지 않는 값이라 반올림된다.
        expect(formatAmount(0.5, KR)).toBe('₩1');
    });

    it('$1 미만은 유효자리를 보존한다', () => {
        // 고정 2자리라면 "$0"으로 뭉개지는 값이다. `dynamicDecimals`는 유효자리
        // 기준이라 자릿수를 넉넉히 잡고 후행 0을 남긴다 — 뭉개짐을 막는 게 이
        // 분기의 목적이므로 그 편이 안전한 쪽이다.
        expect(formatAmount(0.0006, US)).toBe('$0.0006000');
        expect(formatAmount(0.99, US)).toBe('$0.9900');
        /*
         * 음수는 단언하지 않는다. 두 함수의 입력은 전 호출부에서 **가격**뿐이고
         * (52주 고·저, 종가, 평단, 밴드 경계 — 전부 음이 아니다), 손익률처럼
         * 부호가 붙는 값은 다른 포매터를 쓴다. 도메인 밖 입력을 단언해 두면
         * `$-0.60` 같은 현재 출력이 규약처럼 굳어 버린다.
         */
    });

    it('일반 USD는 후행 0을 자른다', () => {
        expect(formatAmount(300, US)).toBe('$300');
        expect(formatAmount(309.9, US)).toBe('$309.9');
        expect(formatAmount(224.69, US)).toBe('$224.69');
    });

    it('0은 sub-$1 분기를 타지 않는다', () => {
        // `value !== 0` 가드가 없으면 `dynamicDecimals(0)`로 들어간다.
        expect(formatAmount(0, US)).toBe('$0');
    });
});

describe('formatAmountAligned', () => {
    it('일반 USD는 소수 2자리를 고정한다', () => {
        expect(formatAmountAligned(300, US)).toBe('$300.00');
        expect(formatAmountAligned(309.9, US)).toBe('$309.90');
        expect(formatAmountAligned(224.69, US)).toBe('$224.69');
        expect(formatAmountAligned(0, US)).toBe('$0.00');
    });

    it('원화와 $1 미만은 `formatAmount`와 같은 분기를 그대로 쓴다', () => {
        for (const [value, symbol] of [
            [274_500, KR],
            [0.5, KR],
            [0.0006, US],
            [0.99, US],
        ] as const) {
            expect(formatAmountAligned(value, symbol)).toBe(
                formatAmount(value, symbol)
            );
        }
    });

    it('일반 USD에서만 `formatAmount`와 갈린다', () => {
        expect(formatAmountAligned(300, US)).not.toBe(formatAmount(300, US));
    });

    it('한 문장에 나란히 놓았을 때 자릿수가 어긋나지 않는다', () => {
        // 이 함수가 생긴 이유 그 자체 — 셋이 붙으면 `$309.9`가 오타처럼 읽혔다.
        const parts = [224.69, 344.57, 309.9].map(v =>
            formatAmountAligned(v, US)
        );
        expect(parts).toEqual(['$224.69', '$344.57', '$309.90']);
        const decimals = parts.map(p => p.split('.')[1]?.length);
        expect(new Set(decimals).size).toBe(1);
    });
});
