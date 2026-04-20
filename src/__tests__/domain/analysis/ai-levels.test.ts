import {
    SL_FALLBACK_ATR_MULTIPLIER,
    SL_MAX_ATR_MULTIPLIER,
    TP_FALLBACK_ATR_MULTIPLIER,
    TP_MAX_ATR_MULTIPLIER,
    buildBullishExitText,
    buildBullishRiskRewardText,
    deriveFallbackStopLoss,
    deriveFallbackTakeProfit,
    isValidBullishStopLoss,
    isValidBullishTakeProfit,
    postProcessAnalysisWithReconcile,
    reconcileBullishActionRecommendation,
    resolveBullishStopLoss,
    resolveBullishTakeProfit,
} from '@/domain/analysis/ai-levels';
import type { ActionRecommendation, AnalysisResponse } from '@/domain/types';

describe('isValidBullishStopLoss', () => {
    it.each<
        [
            label: string,
            sl: number | undefined,
            atr: number | undefined,
            expected: boolean,
        ]
    >([
        ['SL below entry, within ATR*5', 95, 5, true],
        ['SL equal to entry', 100, 5, false],
        ['SL above entry', 105, 5, false],
        [
            'SL far below entry (> ATR*5)',
            100 - 5 * SL_MAX_ATR_MULTIPLIER - 0.01,
            5,
            false,
        ],
        [
            'SL exactly at entry - ATR*5 boundary',
            100 - 5 * SL_MAX_ATR_MULTIPLIER,
            5,
            true,
        ],
        ['ATR undefined, SL below entry', 95, undefined, true],
        ['ATR = 0, SL below entry (ATR bound skipped)', 95, 0, true],
        ['ATR negative, SL below entry (ATR bound skipped)', 95, -1, true],
        ['ATR = NaN, SL below entry (ATR bound skipped)', 95, Number.NaN, true],
        ['SL = 0', 0, 5, false],
        ['SL negative', -10, 5, false],
        ['SL = NaN', Number.NaN, 5, false],
        ['SL = Infinity', Number.POSITIVE_INFINITY, 5, false],
        ['SL = -Infinity', Number.NEGATIVE_INFINITY, 5, false],
        ['SL = undefined', undefined, 5, false],
    ])('%s → %s', (_label, sl, atr, expected) => {
        expect(isValidBullishStopLoss(sl, 100, atr)).toBe(expected);
    });
});

describe('isValidBullishTakeProfit', () => {
    it.each<
        [
            label: string,
            tp: number | undefined,
            atr: number | undefined,
            expected: boolean,
        ]
    >([
        ['TP above entry, within ATR*10', 110, 5, true],
        ['TP equal to entry', 100, 5, false],
        ['TP below entry', 95, 5, false],
        [
            'TP far above entry (> ATR*10)',
            100 + 5 * TP_MAX_ATR_MULTIPLIER + 0.01,
            5,
            false,
        ],
        [
            'TP exactly at entry + ATR*10 boundary',
            100 + 5 * TP_MAX_ATR_MULTIPLIER,
            5,
            true,
        ],
        ['ATR undefined, TP above entry', 110, undefined, true],
        ['ATR = 0, TP above entry (ATR bound skipped)', 110, 0, true],
        ['TP = 0', 0, 5, false],
        ['TP negative', -5, 5, false],
        ['TP = NaN', Number.NaN, 5, false],
        ['TP = Infinity', Number.POSITIVE_INFINITY, 5, false],
        ['TP = undefined', undefined, 5, false],
    ])('%s → %s', (_label, tp, atr, expected) => {
        expect(isValidBullishTakeProfit(tp, 100, atr)).toBe(expected);
    });
});

describe('deriveFallbackStopLoss', () => {
    it('returns entryPrice - ATR * SL_FALLBACK_ATR_MULTIPLIER when ATR is positive', () => {
        const result = deriveFallbackStopLoss(100, 5);
        expect(result).toBeCloseTo(100 - 5 * SL_FALLBACK_ATR_MULTIPLIER, 6);
        expect(result).toBeCloseTo(92.5, 6);
    });

    it('returns undefined when ATR = 0', () => {
        expect(deriveFallbackStopLoss(100, 0)).toBeUndefined();
    });

    it('returns undefined when ATR is undefined', () => {
        expect(deriveFallbackStopLoss(100, undefined)).toBeUndefined();
    });

    it('returns undefined when ATR is negative', () => {
        expect(deriveFallbackStopLoss(100, -1)).toBeUndefined();
    });

    it('returns undefined when ATR is NaN', () => {
        expect(deriveFallbackStopLoss(100, Number.NaN)).toBeUndefined();
    });

    it('returns undefined when ATR is Infinity', () => {
        // Infinity * multiplier → Infinity; we treat it as unusable to match isFinite guard.
        expect(
            deriveFallbackStopLoss(100, Number.POSITIVE_INFINITY)
        ).toBeUndefined();
    });
});

describe('deriveFallbackTakeProfit', () => {
    it('returns entryPrice + ATR * TP_FALLBACK_ATR_MULTIPLIER when ATR is positive', () => {
        const result = deriveFallbackTakeProfit(100, 5);
        expect(result).toBeCloseTo(100 + 5 * TP_FALLBACK_ATR_MULTIPLIER, 6);
        expect(result).toBeCloseTo(110, 6);
    });

    it('returns undefined when ATR = 0', () => {
        expect(deriveFallbackTakeProfit(100, 0)).toBeUndefined();
    });

    it('returns undefined when ATR is undefined', () => {
        expect(deriveFallbackTakeProfit(100, undefined)).toBeUndefined();
    });

    it('returns undefined when ATR is negative', () => {
        expect(deriveFallbackTakeProfit(100, -0.001)).toBeUndefined();
    });
});

describe('resolveBullishStopLoss', () => {
    it('valid AI value → { value: aiValue, source: "ai" }', () => {
        const result = resolveBullishStopLoss(95, 100, 5);
        expect(result.source).toBe('ai');
        expect(result.value).toBe(95);
    });

    it('invalid AI value + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishStopLoss(105, 100, 5); // SL above entry invalid
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(
            100 - 5 * SL_FALLBACK_ATR_MULTIPLIER,
            6
        );
    });

    it('invalid AI value + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishStopLoss(105, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI undefined + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishStopLoss(undefined, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(92.5, 6);
    });

    it('AI undefined + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishStopLoss(undefined, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI too far below entry + ATR present → fallback', () => {
        const farSl = 100 - 5 * SL_MAX_ATR_MULTIPLIER - 10;
        const result = resolveBullishStopLoss(farSl, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(92.5, 6);
    });

    it('AI NaN + ATR = 0 → missing', () => {
        const result = resolveBullishStopLoss(Number.NaN, 100, 0);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });
});

describe('resolveBullishTakeProfit', () => {
    it('valid AI value → { value: aiValue, source: "ai" }', () => {
        const result = resolveBullishTakeProfit(110, 100, 5);
        expect(result.source).toBe('ai');
        expect(result.value).toBe(110);
    });

    it('invalid AI value + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishTakeProfit(95, 100, 5); // TP below entry invalid
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(
            100 + 5 * TP_FALLBACK_ATR_MULTIPLIER,
            6
        );
    });

    it('invalid AI value + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishTakeProfit(95, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI undefined + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishTakeProfit(undefined, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(110, 6);
    });

    it('AI undefined + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishTakeProfit(undefined, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI too far above entry + ATR present → fallback', () => {
        const farTp = 100 + 5 * TP_MAX_ATR_MULTIPLIER + 50;
        const result = resolveBullishTakeProfit(farTp, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(110, 6);
    });

    it('AI Infinity + ATR = 0 → missing', () => {
        const result = resolveBullishTakeProfit(
            Number.POSITIVE_INFINITY,
            100,
            0
        );
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });
});

describe('buildBullishExitText', () => {
    it('SL + 단일 TP 모두 있으면 목표가/손절 텍스트를 반환한다', () => {
        expect(buildBullishExitText(100, 95, [110])).toBe(
            '목표가 $110.00 (+10.0%)에서 익절, 손절 $95.00 (-5.0%).'
        );
    });

    it('TP만 있으면 목표가 텍스트만 반환한다', () => {
        expect(buildBullishExitText(100, undefined, [110])).toBe(
            '목표가 $110.00 (+10.0%)에서 익절.'
        );
    });

    it('SL만 있으면 손절 텍스트만 반환한다', () => {
        expect(buildBullishExitText(100, 95, undefined)).toBe(
            '손절 $95.00 (-5.0%).'
        );
    });

    it('TP 배열이 빈 배열이고 SL이 없으면 빈 문자열을 반환한다', () => {
        expect(buildBullishExitText(100, undefined, [])).toBe('');
    });

    it('둘 다 undefined면 빈 문자열을 반환한다', () => {
        expect(buildBullishExitText(100, undefined, undefined)).toBe('');
    });

    it('복수 TP면 "1차 목표, 2차 목표" 형식으로 출력한다', () => {
        expect(buildBullishExitText(100, 95, [110, 120])).toBe(
            '1차 목표 $110.00 (+10.0%), 2차 목표 $120.00 (+20.0%)에서 익절, 손절 $95.00 (-5.0%).'
        );
    });

    it('복수 TP 3개 + SL 없음도 올바르게 포맷된다', () => {
        expect(buildBullishExitText(100, undefined, [110, 120, 130])).toBe(
            '1차 목표 $110.00 (+10.0%), 2차 목표 $120.00 (+20.0%), 3차 목표 $130.00 (+30.0%)에서 익절.'
        );
    });

    it('NaN TP는 건너뛴다', () => {
        expect(buildBullishExitText(100, 95, [Number.NaN])).toBe(
            '손절 $95.00 (-5.0%).'
        );
    });

    it('NaN SL은 건너뛴다', () => {
        expect(buildBullishExitText(100, Number.NaN, [110])).toBe(
            '목표가 $110.00 (+10.0%)에서 익절.'
        );
    });
});

describe('buildBullishRiskRewardText', () => {
    it('표준 위험:보상 비율을 signed pct로 계산한다', () => {
        // entry=100, sl=95 (-5.0%), tp=110 (+10.0%) → 1:2.0
        expect(buildBullishRiskRewardText(100, 95, [110])).toBe(
            '손절 -5.0% vs 목표 +10.0% → 위험:보상 = 1:2.0'
        );
    });

    it('명세 예시: 손절 -1.7% vs 목표 +3.2% → 1:1.9', () => {
        // entry=100, sl=98.3 (-1.7%), tp=103.2 (+3.2%) → ratio = 3.2/1.7 = 1.88 → 1.9
        expect(buildBullishRiskRewardText(100, 98.3, [103.2])).toBe(
            '손절 -1.7% vs 목표 +3.2% → 위험:보상 = 1:1.9'
        );
    });

    it('SL이 없으면 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, undefined, [110])).toBe('');
    });

    it('TP가 없으면 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, 95, undefined)).toBe('');
    });

    it('TP 배열이 빈 배열이면 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, 95, [])).toBe('');
    });

    it('SL이 entry와 같으면 riskAbs=0이 되어 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, 100, [110])).toBe('');
    });

    it('TP[0]이 NaN이면 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, 95, [Number.NaN])).toBe('');
    });

    it('TP가 entry보다 낮으면 빈 문자열을 반환한다 (음수 R:R 방지)', () => {
        expect(buildBullishRiskRewardText(100, 95, [80])).toBe('');
    });

    it('TP가 entry와 같으면 빈 문자열을 반환한다', () => {
        expect(buildBullishRiskRewardText(100, 95, [100])).toBe('');
    });
});

describe('reconcileBullishActionRecommendation', () => {
    const baseRec: ActionRecommendation = {
        positionAnalysis: '분석 내용',
        entry: '진입 전략',
        exit: 'AI 원본 exit 텍스트',
        riskReward: 'AI 원본 riskReward 텍스트',
        entryRecommendation: 'enter',
        entryPrices: [100],
        stopLoss: 95,
        takeProfitPrices: [110],
    };

    it('AI 값이 모두 유효하면 원본을 그대로 유지한다 (reconciledLevels 없음)', () => {
        const result = reconcileBullishActionRecommendation(baseRec, 100, 2);
        expect(result.wasReconciled).toBe(false);
        expect(result.recommendation).toBe(baseRec);
        expect(result.recommendation.reconciledLevels).toBeUndefined();
        expect(result.changes).toEqual([]);
    });

    it('avoid 일 때는 보정하지 않는다 (reconciledLevels undefined, wasReconciled=false)', () => {
        const rec: ActionRecommendation = {
            ...baseRec,
            entryRecommendation: 'avoid',
            stopLoss: undefined,
            takeProfitPrices: undefined,
        };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(false);
        expect(result.recommendation).toBe(rec);
        expect(result.recommendation.reconciledLevels).toBeUndefined();
    });

    it('AI 원본 필드는 보정 후에도 불변이다 (stopLoss/takeProfitPrices/exit/riskReward)', () => {
        const rec = { ...baseRec, stopLoss: 50 }; // 50 invalid → fallback
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);
        // AI originals preserved
        expect(result.recommendation.stopLoss).toBe(rec.stopLoss);
        expect(result.recommendation.takeProfitPrices).toBe(
            rec.takeProfitPrices
        );
        expect(result.recommendation.exit).toBe(rec.exit);
        expect(result.recommendation.riskReward).toBe(rec.riskReward);
    });

    it('SL이 무효하면 reconciledLevels에 fallback + 재생성 텍스트를 담는다', () => {
        // entry=100, ATR=5, 불합리한 SL 50 (ATR*5=25 밖)
        const rec = { ...baseRec, stopLoss: 50 };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);

        const reconciled = result.recommendation.reconciledLevels;
        expect(reconciled).toBeDefined();
        expect(reconciled?.stopLoss).toBeCloseTo(92.5, 3);
        // TP는 AI 값 유효 → reconciledLevels.takeProfitPrices는 AI 원본 참조
        expect(reconciled?.takeProfitPrices).toBe(rec.takeProfitPrices);
        expect(reconciled?.exit).toContain('손절 $92.50');
        expect(reconciled?.riskReward).toContain('→ 위험:보상 =');
        expect(reconciled?.reason).toContain('손절가');

        expect(result.changes.length).toBeGreaterThan(0);
        expect(result.changes[0]).toMatch(/stopLoss: 50 → 92\.50 \(fallback\)/);
    });

    it('TP가 누락되면 reconciledLevels에 fallback을 담는다', () => {
        const rec = { ...baseRec, takeProfitPrices: undefined };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);

        const reconciled = result.recommendation.reconciledLevels;
        expect(reconciled).toBeDefined();
        expect(reconciled?.takeProfitPrices?.[0]).toBeCloseTo(110, 3);
        expect(result.changes.some(c => c.includes('takeProfitPrices'))).toBe(
            true
        );
        expect(reconciled?.reason).toContain('목표가를 제시하지 않아');
    });

    it('ATR 없이 SL side만 통과하면 reconciledLevels를 추가하지 않는다', () => {
        const rec = { ...baseRec, stopLoss: 50, takeProfitPrices: undefined };
        const result = reconcileBullishActionRecommendation(
            rec,
            100,
            undefined
        );
        // ATR 없어서 side check만 통과하면 SL 50은 valid, TP 누락 + ATR 없음 → missing → wasReconciled=false
        expect(result.wasReconciled).toBe(false);
        expect(result.recommendation).toBe(rec);
        expect(result.recommendation.reconciledLevels).toBeUndefined();
    });

    it('ATR 없고 SL 무효(entry 이상)이면 fallback 없어서 wasReconciled=false', () => {
        const rec = { ...baseRec, stopLoss: 150 };
        const result = reconcileBullishActionRecommendation(
            rec,
            100,
            undefined
        );
        expect(result.wasReconciled).toBe(false);
        expect(result.recommendation).toBe(rec);
        expect(result.recommendation.reconciledLevels).toBeUndefined();
    });

    it('AI TP 여러 개 중 첫 번째만 보정하고 나머지는 보존한다 (reconciledLevels)', () => {
        // [0]=50 invalid (entry 이하) → fallback 110. [1]=120, [2]=130은 그대로.
        const rec = { ...baseRec, takeProfitPrices: [50, 120, 130] };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);

        const reconciled = result.recommendation.reconciledLevels;
        expect(reconciled?.takeProfitPrices?.[0]).toBeCloseTo(110, 3);
        expect(reconciled?.takeProfitPrices?.[1]).toBe(120);
        expect(reconciled?.takeProfitPrices?.[2]).toBe(130);

        // AI 원본은 불변
        expect(result.recommendation.takeProfitPrices).toBe(
            rec.takeProfitPrices
        );
    });

    it('AI TP 여러 개일 때 reconciledLevels.exit에 "1차/2차" 형식 포함', () => {
        // [0]=50 invalid → fallback 110, [1]=150.
        const rec = { ...baseRec, takeProfitPrices: [50, 150] };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);
        expect(result.recommendation.reconciledLevels?.exit).toContain(
            '1차 목표'
        );
        expect(result.recommendation.reconciledLevels?.exit).toContain(
            '2차 목표'
        );
    });

    it('SL과 TP 모두 무효하면 둘 다 reconciledLevels에 fallback 적용', () => {
        const rec = { ...baseRec, stopLoss: 50, takeProfitPrices: [200] };
        // SL 50 (ATR*5=25 범위 밖), TP 200 (ATR*10=50 범위 밖)
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.wasReconciled).toBe(true);

        const reconciled = result.recommendation.reconciledLevels;
        expect(reconciled?.stopLoss).toBeCloseTo(92.5, 3);
        expect(reconciled?.takeProfitPrices?.[0]).toBeCloseTo(110, 3);
        expect(result.changes.length).toBe(2);
        expect(reconciled?.reason).toContain('내부 기준을 벗어나');
    });

    it('원본 rec 객체를 변경하지 않는다 (불변성)', () => {
        const rec = { ...baseRec, stopLoss: 50 };
        const originalSl = rec.stopLoss;
        const originalExit = rec.exit;
        reconcileBullishActionRecommendation(rec, 100, 5);
        expect(rec.stopLoss).toBe(originalSl);
        expect(rec.exit).toBe(originalExit);
    });

    it('positionAnalysis, entry, entryPrices, entryRecommendation은 건드리지 않는다', () => {
        const rec = { ...baseRec, stopLoss: 50 };
        const result = reconcileBullishActionRecommendation(rec, 100, 5);
        expect(result.recommendation.positionAnalysis).toBe(
            baseRec.positionAnalysis
        );
        expect(result.recommendation.entry).toBe(baseRec.entry);
        expect(result.recommendation.entryPrices).toEqual(baseRec.entryPrices);
        expect(result.recommendation.entryRecommendation).toBe(
            baseRec.entryRecommendation
        );
    });

    describe('reconcile reason 문구 (4가지)', () => {
        it('SL+TP 모두 누락 → 공통 "손절·목표가를 제시하지 않아"', () => {
            const rec: ActionRecommendation = {
                ...baseRec,
                stopLoss: undefined,
                takeProfitPrices: undefined,
            };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 손절·목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
            );
        });

        it('SL+TP 모두 무효 → "손절·목표가 중 일부가 내부 기준을 벗어나"', () => {
            const rec = {
                ...baseRec,
                stopLoss: 50,
                takeProfitPrices: [200],
            };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 제시한 손절·목표가 중 일부가 내부 기준을 벗어나 보정했습니다.'
            );
        });

        it('SL만 누락 → "손절가를 제시하지 않아"', () => {
            const rec: ActionRecommendation = {
                ...baseRec,
                stopLoss: undefined,
            };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 손절가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
            );
        });

        it('SL만 무효 → "손절가가 내부 기준을 벗어나"', () => {
            const rec = { ...baseRec, stopLoss: 50 };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 제시한 손절가가 내부 기준을 벗어나 보정했습니다.'
            );
        });

        it('TP만 누락 → "목표가를 제시하지 않아"', () => {
            const rec: ActionRecommendation = {
                ...baseRec,
                takeProfitPrices: undefined,
            };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
            );
        });

        it('TP만 무효 → "목표가가 내부 기준을 벗어나"', () => {
            const rec = { ...baseRec, takeProfitPrices: [200] };
            const result = reconcileBullishActionRecommendation(rec, 100, 5);
            expect(result.recommendation.reconciledLevels?.reason).toBe(
                'AI가 제시한 목표가가 내부 기준을 벗어나 보정했습니다.'
            );
        });
    });
});

describe('postProcessAnalysisWithReconcile', () => {
    const baseResponse: AnalysisResponse = {
        summary: 's',
        trend: 'bullish',
        indicatorResults: [],
        riskLevel: 'low',
        keyLevels: { support: [], resistance: [] },
        priceTargets: {
            bullish: { targets: [], condition: '' },
            bearish: { targets: [], condition: '' },
        },
        patternSummaries: [],
        strategyResults: [],
        candlePatterns: [],
        trendlines: [],
    };

    const rec: ActionRecommendation = {
        positionAnalysis: '분석',
        entry: '진입',
        exit: '원본 exit',
        riskReward: '원본 riskReward',
        entryRecommendation: 'enter',
        entryPrices: [100],
        stopLoss: 95,
        takeProfitPrices: [110],
    };

    it('actionRecommendation이 없으면 원본을 그대로 반환한다', () => {
        const result = postProcessAnalysisWithReconcile(baseResponse, 100, 5);
        expect(result).toBe(baseResponse);
    });

    it('entryPrices midpoint: [100, 120] → entryPrice 110 사용', () => {
        // SL 103 (< 110)은 ATR*5=25 밖이 아니므로 valid → reconcile 안됨.
        // entryPrice가 올바르게 midpoint로 계산됐는지 확인하기 위해,
        // midpoint 기준으로만 무효한 SL 105를 사용한다.
        // entry 110 기준 SL 105 < 110 valid.
        // 대신 midpoint 기준으로 무효(entry 초과)한 SL 115를 사용.
        const response = {
            ...baseResponse,
            actionRecommendation: {
                ...rec,
                entryPrices: [100, 120],
                stopLoss: 115,
            },
        };
        const result = postProcessAnalysisWithReconcile(response, 999, 5);
        // midpoint 110 기준 SL 115 > entry → invalid → fallback 110 - 5*1.5 = 102.5
        expect(
            result.actionRecommendation?.reconciledLevels?.stopLoss
        ).toBeCloseTo(102.5, 3);
        // AI 원본은 그대로
        expect(result.actionRecommendation?.stopLoss).toBe(115);
    });

    it('entryPrices가 없으면 fallbackEntryPrice를 사용한다', () => {
        const recNoEntry = { ...rec, entryPrices: undefined, stopLoss: 50 };
        const response = {
            ...baseResponse,
            actionRecommendation: recNoEntry,
        };
        const result = postProcessAnalysisWithReconcile(response, 100, 5);
        expect(
            result.actionRecommendation?.reconciledLevels?.stopLoss
        ).toBeCloseTo(92.5, 3);
        // AI 원본 불변
        expect(result.actionRecommendation?.stopLoss).toBe(50);
    });

    it('entryPrice를 결정할 수 없으면 원본을 반환한다', () => {
        const recNoEntry = { ...rec, entryPrices: undefined, stopLoss: 50 };
        const response = {
            ...baseResponse,
            actionRecommendation: recNoEntry,
        };
        const result = postProcessAnalysisWithReconcile(response, undefined, 5);
        expect(result).toBe(response);
    });

    it('AI 값이 모두 유효하면 recommendation은 같은 참조이고 reconciledLevels 없음', () => {
        const response = { ...baseResponse, actionRecommendation: rec };
        const result = postProcessAnalysisWithReconcile(response, 100, 2);
        expect(result.actionRecommendation).toBe(rec);
        expect(result.actionRecommendation?.reconciledLevels).toBeUndefined();
    });

    it('AI SL이 무효하면 reconciledLevels가 병기되고 AI 원본 필드는 불변', () => {
        const response = {
            ...baseResponse,
            actionRecommendation: { ...rec, stopLoss: 50 },
        };
        const result = postProcessAnalysisWithReconcile(response, 100, 5);
        expect(
            result.actionRecommendation?.reconciledLevels?.stopLoss
        ).toBeCloseTo(92.5, 3);
        // AI 원본 불변
        expect(result.actionRecommendation?.stopLoss).toBe(50);
        expect(result.actionRecommendation?.exit).toBe('원본 exit');
        expect(result.actionRecommendation?.riskReward).toBe('원본 riskReward');
    });

    it('ATR이 undefined이고 SL이 side 체크만 통과하면 reconciledLevels 없음', () => {
        const response = {
            ...baseResponse,
            actionRecommendation: { ...rec, stopLoss: 50 },
        };
        const result = postProcessAnalysisWithReconcile(
            response,
            100,
            undefined
        );
        // ATR 없어서 side check만 수행, SL 50 < entry 100 → valid, reconciledLevels 없음
        expect(result.actionRecommendation?.stopLoss).toBe(50);
        expect(result.actionRecommendation?.exit).toBe('원본 exit');
        expect(result.actionRecommendation?.reconciledLevels).toBeUndefined();
    });

    it('entryRecommendation=avoid 이면 reconciledLevels 생성 안 함', () => {
        const response = {
            ...baseResponse,
            actionRecommendation: {
                ...rec,
                entryRecommendation: 'avoid' as const,
                stopLoss: undefined,
                takeProfitPrices: undefined,
            },
        };
        const result = postProcessAnalysisWithReconcile(response, 100, 5);
        expect(result.actionRecommendation?.reconciledLevels).toBeUndefined();
    });
});
