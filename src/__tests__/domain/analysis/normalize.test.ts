import {
    asArray,
    asBoolean,
    asEnum,
    asNumber,
    asObject,
    asOptionalEnum,
    asString,
    normalizeActionRecommendation,
    normalizeCandlePatternSummary,
    normalizeIndicatorGuideResult,
    normalizeKeyLevel,
    normalizeKeyLevels,
    normalizeKeyPrice,
    normalizePatternLine,
    normalizePatternSummary,
    normalizePriceScenario,
    normalizePriceTarget,
    normalizePriceTargets,
    normalizeRiskLevel,
    normalizeSignal,
    normalizeStrategyResult,
    normalizeTimeRange,
    normalizeTrend,
    normalizeTrendline,
    normalizeTrendlinePoint,
} from '@/domain/analysis/normalize';

describe('원시 값 헬퍼', () => {
    describe('asString', () => {
        it('문자열이면 그대로 반환한다', () => {
            expect(asString('hello')).toBe('hello');
        });

        it('문자열이 아니면 기본값을 반환한다', () => {
            expect(asString(123)).toBe('');
            expect(asString({})).toBe('');
            expect(asString(null)).toBe('');
            expect(asString(undefined)).toBe('');
        });

        it('fallback 인자를 사용한다', () => {
            expect(asString(null, 'fallback')).toBe('fallback');
        });
    });

    describe('asNumber', () => {
        it('유한한 숫자면 그대로 반환한다', () => {
            expect(asNumber(42)).toBe(42);
            expect(asNumber(0)).toBe(0);
            expect(asNumber(-1.5)).toBe(-1.5);
        });

        it('숫자가 아니면 undefined를 반환한다', () => {
            expect(asNumber('42')).toBeUndefined();
            expect(asNumber(null)).toBeUndefined();
            expect(asNumber({})).toBeUndefined();
        });

        it('NaN과 Infinity는 undefined로 처리한다', () => {
            expect(asNumber(NaN)).toBeUndefined();
            expect(asNumber(Infinity)).toBeUndefined();
            expect(asNumber(-Infinity)).toBeUndefined();
        });
    });

    describe('asBoolean', () => {
        it('불리언이면 그대로 반환한다', () => {
            expect(asBoolean(true)).toBe(true);
            expect(asBoolean(false)).toBe(false);
        });

        it('불리언이 아니면 기본값을 반환한다', () => {
            expect(asBoolean('true')).toBe(false);
            expect(asBoolean(1)).toBe(false);
            expect(asBoolean(null)).toBe(false);
        });

        it('fallback 인자를 사용한다', () => {
            expect(asBoolean(null, true)).toBe(true);
        });
    });

    describe('asEnum', () => {
        const colors = ['red', 'green', 'blue'] as const;

        it('유효한 값이면 그대로 반환한다', () => {
            expect(asEnum('red', colors, 'green')).toBe('red');
        });

        it('유효하지 않으면 fallback을 반환한다', () => {
            expect(asEnum('purple', colors, 'green')).toBe('green');
            expect(asEnum(null, colors, 'green')).toBe('green');
        });
    });

    describe('asOptionalEnum', () => {
        const colors = ['red', 'green', 'blue'] as const;

        it('유효한 값이면 그대로 반환한다', () => {
            expect(asOptionalEnum('red', colors)).toBe('red');
        });

        it('유효하지 않으면 undefined를 반환한다', () => {
            expect(asOptionalEnum('purple', colors)).toBeUndefined();
            expect(asOptionalEnum(null, colors)).toBeUndefined();
        });
    });

    describe('asObject', () => {
        it('일반 객체는 그대로 반환한다', () => {
            const obj = { foo: 'bar' };
            expect(asObject(obj)).toBe(obj);
        });

        it('null은 null을 반환한다', () => {
            expect(asObject(null)).toBeNull();
        });

        it('undefined는 null을 반환한다', () => {
            expect(asObject(undefined)).toBeNull();
        });

        it('배열은 null을 반환한다', () => {
            expect(asObject([])).toBeNull();
            expect(asObject([1, 2])).toBeNull();
        });

        it('원시 값은 null을 반환한다', () => {
            expect(asObject('string')).toBeNull();
            expect(asObject(42)).toBeNull();
            expect(asObject(true)).toBeNull();
        });
    });

    describe('asArray', () => {
        it('배열이면 그대로 반환한다', () => {
            const arr = [1, 2, 3];
            expect(asArray(arr)).toBe(arr);
        });

        it('배열이 아니면 빈 배열을 반환한다', () => {
            expect(asArray(null)).toEqual([]);
            expect(asArray({})).toEqual([]);
            expect(asArray('not array')).toEqual([]);
        });
    });
});

describe('enum 래퍼', () => {
    describe('normalizeTrend', () => {
        it('유효한 Trend 값을 그대로 반환한다', () => {
            expect(normalizeTrend('bullish')).toBe('bullish');
            expect(normalizeTrend('bearish')).toBe('bearish');
            expect(normalizeTrend('neutral')).toBe('neutral');
        });

        it('유효하지 않으면 neutral을 반환한다', () => {
            expect(normalizeTrend('up')).toBe('neutral');
            expect(normalizeTrend(null)).toBe('neutral');
        });
    });

    describe('normalizeRiskLevel', () => {
        it('유효한 RiskLevel을 그대로 반환한다', () => {
            expect(normalizeRiskLevel('low')).toBe('low');
            expect(normalizeRiskLevel('medium')).toBe('medium');
            expect(normalizeRiskLevel('high')).toBe('high');
        });

        it('유효하지 않으면 medium을 반환한다', () => {
            expect(normalizeRiskLevel('extreme')).toBe('medium');
            expect(normalizeRiskLevel(undefined)).toBe('medium');
        });
    });
});

describe('normalizeKeyLevel', () => {
    it('유효한 객체를 그대로 반환한다', () => {
        expect(normalizeKeyLevel({ price: 100, reason: '지지' })).toEqual({
            price: 100,
            reason: '지지',
        });
    });

    it('reason이 문자열이 아니면 빈 문자열로 대체한다', () => {
        expect(normalizeKeyLevel({ price: 100, reason: null })).toEqual({
            price: 100,
            reason: '',
        });
    });

    it('price가 숫자가 아니면 null을 반환한다', () => {
        expect(normalizeKeyLevel({ price: '100', reason: 'x' })).toBeNull();
        expect(normalizeKeyLevel({ reason: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeKeyLevel(null)).toBeNull();
        expect(normalizeKeyLevel('foo')).toBeNull();
    });
});

describe('normalizeKeyLevels', () => {
    it('모든 필드를 정규화한다', () => {
        const result = normalizeKeyLevels({
            support: [{ price: 100, reason: 'S1' }],
            resistance: [{ price: 200, reason: 'R1' }],
            poc: { price: 150, reason: 'POC' },
        });
        expect(result.support).toEqual([{ price: 100, reason: 'S1' }]);
        expect(result.resistance).toEqual([{ price: 200, reason: 'R1' }]);
        expect(result.poc).toEqual({ price: 150, reason: 'POC' });
    });

    it('지원/저항 배열의 잘못된 항목은 탈락시킨다', () => {
        const result = normalizeKeyLevels({
            support: [
                { price: 100, reason: 'S1' },
                { reason: '가격없음' },
                'invalid',
            ],
            resistance: [],
        });
        expect(result.support).toHaveLength(1);
        expect(result.support[0].price).toBe(100);
    });

    it('객체가 아니면 빈 기본값을 반환한다', () => {
        expect(normalizeKeyLevels(null)).toEqual({
            support: [],
            resistance: [],
            poc: undefined,
        });
    });

    it('poc가 잘못된 형식이면 undefined로 처리한다', () => {
        const result = normalizeKeyLevels({
            support: [],
            resistance: [],
            poc: { reason: 'no price' },
        });
        expect(result.poc).toBeUndefined();
    });

    it('배열 필드가 누락되면 빈 배열로 대체한다', () => {
        const result = normalizeKeyLevels({});
        expect(result.support).toEqual([]);
        expect(result.resistance).toEqual([]);
    });
});

describe('normalizePriceTarget', () => {
    it('유효한 객체를 그대로 반환한다', () => {
        expect(normalizePriceTarget({ price: 100, basis: '근거' })).toEqual({
            price: 100,
            basis: '근거',
        });
    });

    it('basis가 문자열이 아니면 빈 문자열로 대체한다', () => {
        expect(normalizePriceTarget({ price: 100, basis: 42 })).toEqual({
            price: 100,
            basis: '',
        });
    });

    it('price가 숫자가 아니면 null을 반환한다', () => {
        expect(normalizePriceTarget({ basis: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizePriceTarget(null)).toBeNull();
    });
});

describe('normalizePriceScenario', () => {
    it('유효한 시나리오를 그대로 반환한다', () => {
        expect(
            normalizePriceScenario({
                targets: [{ price: 100, basis: 'b1' }],
                condition: '상승 시',
            })
        ).toEqual({
            targets: [{ price: 100, basis: 'b1' }],
            condition: '상승 시',
        });
    });

    it('targets가 배열이 아니면 빈 배열을 사용한다', () => {
        const result = normalizePriceScenario({
            targets: 'not array',
            condition: 'x',
        });
        expect(result?.targets).toEqual([]);
    });

    it('condition이 문자열이 아니면 빈 문자열로 대체한다', () => {
        const result = normalizePriceScenario({
            targets: [],
            condition: null,
        });
        expect(result?.condition).toBe('');
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizePriceScenario(null)).toBeNull();
    });
});

describe('normalizePriceTargets', () => {
    it('bullish/bearish를 모두 정규화한다', () => {
        const result = normalizePriceTargets({
            bullish: { targets: [], condition: '상승' },
            bearish: { targets: [], condition: '하락' },
        });
        expect(result.bullish?.condition).toBe('상승');
        expect(result.bearish?.condition).toBe('하락');
    });

    it('객체가 아니면 기본값을 반환한다', () => {
        expect(normalizePriceTargets(null)).toEqual({
            bullish: null,
            bearish: null,
        });
    });

    it('bullish/bearish가 누락되면 null을 할당한다', () => {
        const result = normalizePriceTargets({});
        expect(result.bullish).toBeNull();
        expect(result.bearish).toBeNull();
    });
});

describe('normalizeSignal', () => {
    it('유효한 시그널을 반환한다', () => {
        expect(
            normalizeSignal({
                description: '강세',
                trend: 'bullish',
                strength: 'strong',
            })
        ).toEqual({
            type: 'skill',
            description: '강세',
            trend: 'bullish',
            strength: 'strong',
        });
    });

    it('strength가 유효하지 않으면 undefined로 둔다', () => {
        const result = normalizeSignal({
            description: 'x',
            trend: 'neutral',
            strength: 'huge',
        });
        expect(result?.strength).toBeUndefined();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeSignal(null)).toBeNull();
    });
});

describe('normalizeIndicatorGuideResult', () => {
    it('유효한 결과를 반환한다', () => {
        expect(
            normalizeIndicatorGuideResult({
                indicatorName: 'RSI',
                signals: [{ description: '과매수', trend: 'bearish' }],
            })
        ).toEqual({
            indicatorName: 'RSI',
            signals: [
                {
                    type: 'skill',
                    description: '과매수',
                    trend: 'bearish',
                    strength: undefined,
                },
            ],
        });
    });

    it('indicatorName이 없으면 null을 반환한다', () => {
        expect(normalizeIndicatorGuideResult({ signals: [] })).toBeNull();
    });

    it('signals의 잘못된 항목은 탈락시킨다', () => {
        const result = normalizeIndicatorGuideResult({
            indicatorName: 'MACD',
            signals: ['invalid', { description: 'x', trend: 'bullish' }],
        });
        expect(result?.signals).toHaveLength(1);
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeIndicatorGuideResult(null)).toBeNull();
    });
});

describe('normalizeKeyPrice', () => {
    it('유효한 객체를 반환한다', () => {
        expect(normalizeKeyPrice({ label: '진입가', price: 100 })).toEqual({
            label: '진입가',
            price: 100,
        });
    });

    it('price가 숫자가 아니면 null을 반환한다', () => {
        expect(normalizeKeyPrice({ label: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeKeyPrice(null)).toBeNull();
    });
});

describe('normalizeTrendlinePoint', () => {
    it('유효한 객체를 반환한다', () => {
        expect(normalizeTrendlinePoint({ time: 100, price: 200 })).toEqual({
            time: 100,
            price: 200,
        });
    });

    it('time 또는 price가 숫자가 아니면 null을 반환한다', () => {
        expect(normalizeTrendlinePoint({ time: 'x', price: 200 })).toBeNull();
        expect(normalizeTrendlinePoint({ time: 100, price: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeTrendlinePoint(null)).toBeNull();
    });
});

describe('normalizePatternLine', () => {
    it('유효한 라인을 반환한다', () => {
        expect(
            normalizePatternLine({
                label: 'L1',
                start: { time: 1, price: 10 },
                end: { time: 2, price: 20 },
            })
        ).toEqual({
            label: 'L1',
            start: { time: 1, price: 10 },
            end: { time: 2, price: 20 },
        });
    });

    it('start 또는 end가 유효하지 않으면 null을 반환한다', () => {
        expect(
            normalizePatternLine({
                label: 'x',
                start: { time: 1 },
                end: { time: 2, price: 20 },
            })
        ).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizePatternLine(null)).toBeNull();
    });
});

describe('normalizeTimeRange', () => {
    it('유효한 범위를 반환한다', () => {
        expect(normalizeTimeRange({ start: 1, end: 2 })).toEqual({
            start: 1,
            end: 2,
        });
    });

    it('start 또는 end가 숫자가 아니면 undefined를 반환한다', () => {
        expect(normalizeTimeRange({ start: 'x', end: 2 })).toBeUndefined();
        expect(normalizeTimeRange({ start: 1 })).toBeUndefined();
    });

    it('객체가 아니면 undefined를 반환한다', () => {
        expect(normalizeTimeRange(null)).toBeUndefined();
    });
});

describe('normalizePatternSummary', () => {
    it('유효한 요약을 반환한다', () => {
        expect(
            normalizePatternSummary({
                patternName: 'Hammer',
                skillName: '해머 스킬',
                detected: true,
                trend: 'bullish',
                summary: '요약',
            })
        ).toEqual({
            patternName: 'Hammer',
            skillName: '해머 스킬',
            detected: true,
            trend: 'bullish',
            summary: '요약',
            keyPrices: undefined,
            patternLines: undefined,
            timeRange: undefined,
        });
    });

    it('keyPrices와 patternLines를 정규화하여 포함한다', () => {
        const result = normalizePatternSummary({
            patternName: 'P',
            skillName: 'S',
            detected: true,
            trend: 'bullish',
            summary: 'x',
            keyPrices: [{ label: 'x', price: 1 }, 'invalid'],
            patternLines: [
                {
                    label: 'L',
                    start: { time: 1, price: 1 },
                    end: { time: 2, price: 2 },
                },
            ],
            timeRange: { start: 1, end: 2 },
        });
        expect(result?.keyPrices).toHaveLength(1);
        expect(result?.patternLines).toHaveLength(1);
        expect(result?.timeRange).toEqual({ start: 1, end: 2 });
    });

    it('patternName 또는 skillName이 없으면 null을 반환한다', () => {
        expect(normalizePatternSummary({ skillName: 'S' })).toBeNull();
        expect(normalizePatternSummary({ patternName: 'P' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizePatternSummary(null)).toBeNull();
    });
});

describe('normalizeStrategyResult', () => {
    it('유효한 결과를 반환한다', () => {
        expect(
            normalizeStrategyResult({
                strategyName: '추세 추종',
                trend: 'bullish',
                summary: '요약',
            })
        ).toEqual({
            strategyName: '추세 추종',
            trend: 'bullish',
            summary: '요약',
        });
    });

    it('strategyName이 없으면 null을 반환한다', () => {
        expect(normalizeStrategyResult({ summary: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeStrategyResult(null)).toBeNull();
    });
});

describe('normalizeCandlePatternSummary', () => {
    it('유효한 요약을 반환한다', () => {
        expect(
            normalizeCandlePatternSummary({
                patternName: 'Doji',
                detected: true,
                trend: 'neutral',
                summary: '도지',
            })
        ).toEqual({
            patternName: 'Doji',
            detected: true,
            trend: 'neutral',
            summary: '도지',
        });
    });

    it('patternName이 없으면 null을 반환한다', () => {
        expect(normalizeCandlePatternSummary({ summary: 'x' })).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeCandlePatternSummary(null)).toBeNull();
    });
});

describe('normalizeTrendline', () => {
    const validLine = {
        direction: 'ascending',
        start: { time: 1, price: 10 },
        end: { time: 2, price: 20 },
    };

    it('유효한 트렌드라인을 반환한다', () => {
        expect(normalizeTrendline(validLine)).toEqual(validLine);
    });

    it('direction이 유효하지 않으면 null을 반환한다', () => {
        expect(
            normalizeTrendline({ ...validLine, direction: 'sideways' })
        ).toBeNull();
    });

    it('start 또는 end가 유효하지 않으면 null을 반환한다', () => {
        expect(normalizeTrendline({ ...validLine, start: null })).toBeNull();
        expect(
            normalizeTrendline({ ...validLine, end: { time: 2 } })
        ).toBeNull();
    });

    it('객체가 아니면 null을 반환한다', () => {
        expect(normalizeTrendline(null)).toBeNull();
    });
});

describe('normalizeActionRecommendation', () => {
    it('텍스트 필드가 모두 문자열이면 전체를 반환한다', () => {
        const result = normalizeActionRecommendation({
            positionAnalysis: '중립 구간',
            entry: '진입 전략',
            exit: '청산 전략',
            riskReward: '리스크',
            entryRecommendation: 'wait',
            entryPrices: [100, 105],
            stopLoss: 95,
            takeProfitPrices: [110, 120],
        });
        expect(result).toEqual({
            positionAnalysis: '중립 구간',
            entry: '진입 전략',
            exit: '청산 전략',
            riskReward: '리스크',
            entryRecommendation: 'wait',
            entryPrices: [100, 105],
            stopLoss: 95,
            takeProfitPrices: [110, 120],
        });
    });

    it('텍스트 필드에 객체가 오면 빈 문자열로 대체한다', () => {
        const result = normalizeActionRecommendation({
            positionAnalysis: '정상',
            entry: { takeProfitPrices: [110], stopLoss: 95 },
            exit: '청산',
            riskReward: '리스크',
        });
        expect(result?.entry).toBe('');
        expect(result?.positionAnalysis).toBe('정상');
    });

    it('모든 텍스트 필드가 비면 undefined를 반환한다', () => {
        expect(
            normalizeActionRecommendation({
                positionAnalysis: null,
                entry: null,
                exit: null,
                riskReward: null,
            })
        ).toBeUndefined();
    });

    it('entryRecommendation이 유효하지 않으면 undefined로 둔다', () => {
        const result = normalizeActionRecommendation({
            entry: 'x',
            entryRecommendation: 'confirm',
        });
        expect(result?.entryRecommendation).toBeUndefined();
    });

    it('entryPrices/takeProfitPrices 배열에서 숫자 아닌 항목을 걸러낸다', () => {
        const result = normalizeActionRecommendation({
            entry: 'x',
            entryPrices: [100, '105', null],
            takeProfitPrices: [110, NaN],
        });
        expect(result?.entryPrices).toEqual([100]);
        expect(result?.takeProfitPrices).toEqual([110]);
    });

    it('entryPrices/takeProfitPrices가 배열이 아니면 undefined로 둔다', () => {
        const result = normalizeActionRecommendation({
            entry: 'x',
            entryPrices: 'not array',
            takeProfitPrices: null,
        });
        expect(result?.entryPrices).toBeUndefined();
        expect(result?.takeProfitPrices).toBeUndefined();
    });

    it('stopLoss가 숫자가 아니면 undefined로 둔다', () => {
        const result = normalizeActionRecommendation({
            entry: 'x',
            stopLoss: '95',
        });
        expect(result?.stopLoss).toBeUndefined();
    });

    it('객체가 아니면 undefined를 반환한다', () => {
        expect(normalizeActionRecommendation(null)).toBeUndefined();
        expect(normalizeActionRecommendation('string')).toBeUndefined();
    });
});
