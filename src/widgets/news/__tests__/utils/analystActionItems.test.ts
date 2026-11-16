import type { AnalystAction } from '@/entities/analyst-views/model';
import {
    fromAnalystAction,
    fromGradesEvent,
} from '@/widgets/news/utils/analystActionItems';

const row = (over: Partial<AnalystAction> = {}): AnalystAction => ({
    date: '2026-11-10',
    firm: 'Morgan Stanley',
    action: 'upgrade',
    fromGrade: 'Equal-Weight',
    toGrade: 'Overweight',
    priorTarget: 150,
    target: 175,
    targetAction: 'raise',
    ...over,
});

describe('fromAnalystAction', () => {
    it('Yahoo 행을 등급·목표가 행으로 바꾼다', () => {
        expect(fromAnalystAction(row())).toEqual({
            date: '2026-11-10',
            firm: 'Morgan Stanley',
            action: 'upgrade',
            previousGrade: 'Equal-Weight',
            newGrade: 'Overweight',
            target: { prior: 150, current: 175, direction: 'raise' },
        });
    });

    it.each([
        ['maintain', 'maintained'],
        ['reiterate', 'maintained'],
        ['initiate', 'initiated'],
        ['downgrade', 'downgrade'],
    ] as const)('액션 %s → %s', (kind, action) => {
        expect(fromAnalystAction(row({ action: kind }))?.action).toBe(action);
    });

    it('같은 등급 유지는 이전 등급을 비우고, 새 등급이 없으면 이전 등급을 쓴다', () => {
        expect(
            fromAnalystAction(row({ fromGrade: 'Buy', toGrade: 'Buy' }))
                ?.previousGrade
        ).toBeNull();
        expect(
            fromAnalystAction(row({ fromGrade: 'Buy', toGrade: null }))
        ).toMatchObject({ previousGrade: null, newGrade: 'Buy' });
    });

    it('등급이 하나도 없으면 그릴 행이 없고, 목표가가 없으면 target은 null', () => {
        expect(
            fromAnalystAction(row({ fromGrade: null, toGrade: null }))
        ).toBeNull();
        expect(
            fromAnalystAction(row({ target: null, priorTarget: null }))?.target
        ).toBeNull();
    });
});

describe('fromAnalystAction — 목표가 방향', () => {
    it.each([
        [150, 175, 'raise'],
        [200, 160, 'lower'],
        [100, 100, 'maintain'],
        [null, 120, null],
    ] as const)(
        'Yahoo가 방향을 주지 않으면 %s → %s에서 %s로 정한다',
        (prior, target, direction) => {
            expect(
                fromAnalystAction(
                    row({ priorTarget: prior, target, targetAction: null })
                )?.target?.direction
            ).toBe(direction);
        }
    );

    it('Yahoo가 준 방향은 그대로 쓴다', () => {
        expect(
            fromAnalystAction(row({ targetAction: 'announce' }))?.target
                ?.direction
        ).toBe('announce');
    });
});

describe('fromGradesEvent', () => {
    it('등급 이벤트는 목표가 없이 옮긴다', () => {
        expect(
            fromGradesEvent({
                symbol: 'AAPL',
                date: '2025-01-15',
                action: 'initiated',
                gradingCompany: 'JP Morgan',
                previousGrade: null,
                newGrade: 'Overweight',
            })
        ).toEqual({
            date: '2025-01-15',
            firm: 'JP Morgan',
            action: 'initiated',
            previousGrade: null,
            newGrade: 'Overweight',
            target: null,
        });
    });
});
