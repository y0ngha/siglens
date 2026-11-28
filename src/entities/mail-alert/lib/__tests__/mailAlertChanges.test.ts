import type { ChangeReference, TechnicalChange } from '@y0ngha/siglens-core';
import { toMailAlertChanges } from '../mailAlertChanges';

const ANALYZED = '2026-11-20T01:00:00.000Z';

function reference(overrides: Partial<ChangeReference> = {}): ChangeReference {
    return {
        analyzedAt: ANALYZED,
        supports: [180],
        resistances: [200],
        plan: {
            positionAnalysis: '',
            entry: '',
            exit: '',
            riskReward: '',
            entryPrices: [170, 175],
            stopLoss: 160,
            takeProfitPrices: [210],
        },
        ...overrides,
    };
}

const trend: TechnicalChange = {
    kind: 'trend_changed',
    from: 'neutral',
    to: 'bullish',
    slopeAtr: 1.1,
};
const crossed: TechnicalChange = {
    kind: 'level_crossed',
    side: 'support',
    price: 180,
    direction: 'down',
    time: 1,
    close: 178,
    pastNow: true,
};
const planLevel: TechnicalChange = {
    kind: 'plan_level_crossed',
    level: 'stop',
    price: 170,
    direction: 'down',
    time: 1,
    close: 168,
    pastNow: false,
};
const signal: TechnicalChange = {
    kind: 'signal_started',
    type: 'golden_cross',
    direction: 'bullish',
    time: 1,
};

function plan(
    to: 'in_zone' | 'above_zone' | 'below_zone' | 'no_setup',
    reason?: 'no_zone' | 'no_stop' | 'stopped' | 'no_room_above'
): TechnicalChange {
    return {
        kind: 'plan_position_changed',
        from: 'above_zone',
        to,
        ...(reason === undefined ? {} : { reason }),
        time: 2,
        close: 172,
    };
}

describe('toMailAlertChanges', () => {
    it('추세는 분석 없이도 옮기고, 가격 판정은 분석이 있어야 옮긴다', () => {
        expect(toMailAlertChanges([trend, crossed], null)).toEqual([
            { kind: 'trend', from: 'neutral', to: 'bullish' },
        ]);
        expect(toMailAlertChanges([trend, crossed], reference())).toEqual([
            { kind: 'trend', from: 'neutral', to: 'bullish' },
            {
                kind: 'level',
                side: 'support',
                direction: 'down',
                price: 180,
                close: 178,
                analyzedAt: ANALYZED,
            },
        ]);
    });

    it('신호는 여기서 다루지 않는다(신호 줄은 기존 항목이 정본이다)', () => {
        expect(toMailAlertChanges([signal], reference())).toEqual([]);
        expect(toMailAlertChanges([planLevel], reference())).toEqual([]);
    });

    it('코어의 순서를 그대로 지킨다', () => {
        const kinds = toMailAlertChanges(
            [plan('in_zone'), crossed, trend, signal],
            reference()
        ).map(change => change.kind);

        expect(kinds).toEqual(['plan_zone', 'level', 'trend']);
    });

    it.each(['in_zone', 'above_zone', 'below_zone'] as const)(
        '진입 구간 %s는 분석의 구간 양끝과 그 종가를 싣는다',
        position => {
            expect(toMailAlertChanges([plan(position)], reference())).toEqual([
                {
                    kind: 'plan_zone',
                    position,
                    low: 170,
                    high: 175,
                    close: 172,
                    analyzedAt: ANALYZED,
                },
            ]);
        }
    );

    it('무효화 기준 이하(stopped)는 분석의 무효화 기준 가격을 싣는다', () => {
        expect(
            toMailAlertChanges([plan('no_setup', 'stopped')], reference())
        ).toEqual([
            {
                kind: 'plan_stopped',
                stop: 160,
                close: 172,
                analyzedAt: ANALYZED,
            },
        ]);
    });

    it.each(['no_zone', 'no_stop', 'no_room_above'] as const)(
        '계획이 없어졌다는 판정(%s)은 가격으로 말할 수 없어 줄로 만들지 않는다',
        reason => {
            expect(
                toMailAlertChanges([plan('no_setup', reason)], reference())
            ).toEqual([]);
        }
    );

    it('계획이 없는 분석이면 진입 구간·무효화 줄은 없고 지지선 줄은 남는다', () => {
        expect(
            toMailAlertChanges(
                [plan('in_zone'), plan('no_setup', 'stopped'), crossed],
                reference({ plan: null })
            ).map(change => change.kind)
        ).toEqual(['level']);
    });

    it('무효화 기준 가격을 읽지 못하면(구간 아래가 아닌 손절) 값을 지어내지 않고 줄을 뺀다', () => {
        const noStop = reference({
            plan: {
                positionAnalysis: '',
                entry: '',
                exit: '',
                riskReward: '',
                entryPrices: [170, 175],
                takeProfitPrices: [210],
            },
        });

        expect(
            toMailAlertChanges([plan('no_setup', 'stopped')], noStop)
        ).toEqual([]);
    });
});
