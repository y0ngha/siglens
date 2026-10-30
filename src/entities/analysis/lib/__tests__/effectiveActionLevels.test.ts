import { describe, expect, it } from 'vitest';

import { resolveEffectiveActionLevels } from '@/entities/analysis/lib/effectiveActionLevels';

describe('resolveEffectiveActionLevels', () => {
    it('보정값이 있으면 원본 AI 손절/익절 대신 보정값을 쓴다', () => {
        // core는 AI가 낸 레벨이 무효할 때 원본을 그대로 두고 보정값을
        // `reconciledLevels`에 따로 붙인다. 원본만 읽으면 core가 이미
        // 거부한 값을 집어 오게 된다.
        const levels = resolveEffectiveActionLevels({
            stopLoss: 200,
            takeProfitPrices: [1, 165],
            reconciledLevels: {
                stopLoss: 144,
                takeProfitPrices: [158, 165],
            },
        });

        expect(levels.stopLoss).toBe(144);
        expect(levels.takeProfitPrices).toEqual([158, 165]);
    });

    it('보정값이 없으면 원본 AI 값을 그대로 쓴다', () => {
        const levels = resolveEffectiveActionLevels({
            stopLoss: 144,
            takeProfitPrices: [158, 165],
        });

        expect(levels.stopLoss).toBe(144);
        expect(levels.takeProfitPrices).toEqual([158, 165]);
    });

    it('보정 객체가 산문 필드만 담고 있으면 원본으로 되돌아간다', () => {
        // `ReconciledActionLevels`에서 숫자 두 필드는 optional이고 산문
        // 세 필드만 필수다 — 숫자 없이 텍스트만 붙는 형태가 실재한다.
        const levels = resolveEffectiveActionLevels({
            stopLoss: 144,
            takeProfitPrices: [158],
            reconciledLevels: {
                exit: '보정된 청산 전략',
                riskReward: '1:2',
                reason: '손절가가 진입가 위에 있었습니다',
            } as never,
        });

        expect(levels.stopLoss).toBe(144);
        expect(levels.takeProfitPrices).toEqual([158]);
    });

    it('사다리에 섞인 0·NaN은 그 항목만 떨어뜨린다', () => {
        // `0`을 통과시키면 `high >= 0`이 항상 참이라 달성한 적 없는 목표가
        // 달성으로 판정된다.
        const levels = resolveEffectiveActionLevels({
            takeProfitPrices: [0, 158, Number.NaN, 165, -3],
        });

        expect(levels.takeProfitPrices).toEqual([158, 165]);
    });

    it('보정 손절이 0이면 유효한 원본 손절로 되돌아간다', () => {
        const levels = resolveEffectiveActionLevels({
            stopLoss: 144,
            reconciledLevels: { stopLoss: 0 },
        });

        expect(levels.stopLoss).toBe(144);
    });

    it('진입가에 섞인 0·NaN도 그 항목만 떨어뜨린다', () => {
        // core는 진입가를 보정하지 않으므로 `reconciledLevels`에 대응 필드가
        // 없다. 그래도 검증은 손절·익절과 같은 이유로 필요하다 —
        // `entry 0.00`이 리포트·프롬프트에 실제 가격처럼 실린다.
        const levels = resolveEffectiveActionLevels({
            entryPrices: [0, 148, Number.NaN, 150, -1],
        });

        expect(levels.entryPrices).toEqual([148, 150]);
    });

    it('양쪽 다 없으면 undefined', () => {
        expect(resolveEffectiveActionLevels(undefined)).toEqual({
            entryPrices: undefined,
            stopLoss: undefined,
            takeProfitPrices: undefined,
        });
        expect(resolveEffectiveActionLevels({})).toEqual({
            entryPrices: undefined,
            stopLoss: undefined,
            takeProfitPrices: undefined,
        });
    });
});
