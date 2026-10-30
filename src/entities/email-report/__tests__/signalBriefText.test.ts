import type { SignalBrief } from '@/entities/email-report/reportModel';
import { signalBriefText } from '@/entities/email-report/templates/signalBriefText';

const t = (key: string, values?: Record<string, string>): string =>
    values ? `${key}(${Object.values(values).join(',')})` : key;
const LABELS: Record<string, string> = {
    a: 'A',
    b: 'B',
    c: 'C',
    d: 'D',
    e: 'E',
};
const label = (type: string): string | null => LABELS[type] ?? null;

const EMPTY: SignalBrief = {
    score: 50,
    bullish: [],
    bearish: [],
    fresh: [],
    pullback: null,
};

describe('signalBriefText', () => {
    it('점수만 있으면 점수 한 조각', () => {
        expect(signalBriefText(EMPTY, t, label)).toBe('signalScore(50)');
    });

    it('점수가 null이면 보류 문구', () => {
        expect(signalBriefText({ ...EMPTY, score: null }, t, label)).toBe(
            'signalAbstain'
        );
    });

    it('방향·새로 켜짐·눌림목을 | 로 잇는다', () => {
        expect(
            signalBriefText(
                {
                    score: 70,
                    bullish: ['a'],
                    bearish: ['b'],
                    fresh: ['a'],
                    pullback: 'washoutInUptrend',
                },
                t,
                label
            )
        ).toBe(
            'signalScore(70) | signalBullish(1) (A) | signalBearish(1) (B) | signalFresh(A) | signalPullback(pullback.washoutInUptrend)'
        );
    });

    it('라벨은 3개까지 적고 넘치는 만큼은 +N으로 줄인다', () => {
        expect(
            signalBriefText(
                { ...EMPTY, bullish: ['a', 'b', 'c', 'd', 'e'] },
                t,
                label
            )
        ).toContain('signalBullish(5) (A, B, C, signalMore(2))');
    });

    it('사전에 없는 타입은 라벨에서도 개수에서도 뺀다', () => {
        const text = signalBriefText(
            { ...EMPTY, bullish: ['a', 'unknown'], bearish: ['unknown'] },
            t,
            label
        );

        expect(text).toContain('signalBullish(1) (A)');
        expect(text).not.toContain('signalBearish');
        expect(text).not.toContain('unknown');
    });
});
