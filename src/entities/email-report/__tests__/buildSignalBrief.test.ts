import {
    CONFLUENCE_TRIGGER_SCORE,
    scoreConfluence,
    type ConfluenceSnapshot,
    type PullbackSnapshot,
} from '@y0ngha/siglens-core';
import { buildSignalBrief } from '@/entities/email-report/lib/buildSignalBrief';

function snapshot(
    overrides: Partial<ConfluenceSnapshot> = {}
): ConfluenceSnapshot {
    return {
        timeframe: '1Day',
        barTime: 1_759_968_000,
        close: 180.5,
        ma50: 175.2,
        bullish: ['bollinger_lower_bounce', 'macd_bullish_cross'],
        bearish: ['rsi_overbought'],
        freshBullish: ['macd_bullish_cross'],
        freshBearish: ['rsi_overbought'],
        htfTrend: null,
        params: {
            min: 2.5,
            exitMin: 2.5,
            span: 15,
            expectedWeight: 0.5,
            htf: null,
            requireVolume: false,
        },
        entryTrigger: false,
        exitTrigger: false,
        ...overrides,
    };
}

function pullback(overrides: Partial<PullbackSnapshot> = {}): PullbackSnapshot {
    return {
        reading: 'washoutInUptrend',
        close: 180.5,
        ma200: 160,
        closeVsMa200Pct: 12.8,
        ma5: 183,
        williamsR: -93,
        rsi2: 6,
        ...overrides,
    };
}

describe('buildSignalBrief', () => {
    it('컨플루언스 점수·방향별 타입·눌림목 판독을 옮긴다', () => {
        const snap = snapshot();

        const brief = buildSignalBrief({
            confluence: snap,
            pullback: pullback(),
        });

        expect(brief).toEqual({
            score: scoreConfluence(snap),
            bullish: ['bollinger_lower_bounce', 'macd_bullish_cross'],
            bearish: ['rsi_overbought'],
            fresh: ['macd_bullish_cross', 'rsi_overbought'],
            pullback: 'washoutInUptrend',
        });
    });

    it('규칙이 성립한 스냅샷은 core의 스냅 점수를 그대로 받는다', () => {
        expect(
            buildSignalBrief({
                confluence: snapshot({ entryTrigger: true }),
                pullback: null,
            }).score
        ).toBe(CONFLUENCE_TRIGGER_SCORE);
    });

    it('컨플루언스 보류(null)면 점수는 null이고 타입 목록은 빈다', () => {
        const brief = buildSignalBrief({ confluence: null, pullback: null });

        expect(brief.score).toBeNull();
        expect(brief.bullish).toEqual([]);
        expect(brief.bearish).toEqual([]);
        expect(brief.fresh).toEqual([]);
    });

    it('fresh는 상승·하락 합집합이며 중복 없이 정렬된다', () => {
        const brief = buildSignalBrief({
            confluence: snapshot({
                freshBullish: ['golden_cross', 'dmi_bullish_cross'],
                freshBearish: ['golden_cross', 'gap_down'],
            }),
            pullback: null,
        });

        expect(brief.fresh).toEqual([
            'dmi_bullish_cross',
            'gap_down',
            'golden_cross',
        ]);
    });

    it.each([
        ['눌림목 보류(null)', null],
        ['판독 none', pullback({ reading: 'none' })],
    ])('%s이면 pullback은 null이다', (_, snap) => {
        expect(
            buildSignalBrief({ confluence: snapshot(), pullback: snap })
                .pullback
        ).toBeNull();
    });

    it('규칙 상태(entryTrigger/exitTrigger)를 어떤 키로도 담지 않는다', () => {
        const brief = buildSignalBrief({
            confluence: snapshot({ entryTrigger: true, exitTrigger: true }),
            pullback: pullback(),
        });

        expect(JSON.stringify(brief)).not.toMatch(/trigger/i);
        expect(Object.keys(brief)).toEqual([
            'score',
            'bullish',
            'bearish',
            'fresh',
            'pullback',
        ]);
    });
});
