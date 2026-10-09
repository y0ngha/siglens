import {
    EMPTY_MEMBER_NUDGE_RECORD,
    markSymbolNudged,
    recordSymbolAnalysis,
    shouldShowSetupNudge,
    SYMBOL_NUDGE_COOLDOWN_MS,
    SYMBOL_NUDGE_MIN_ANALYSES,
    type MemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgePolicy';

const NOW = Date.parse('2026-10-08T00:00:00Z');

describe('shouldShowSetupNudge', () => {
    const ctx = {
        emailVerified: true,
        holdingsCount: 2,
        watchlistCount: 0,
        reportEnabled: false,
    };

    it('보유 종목이 있고 인증됐고 수신이 꺼진 회원에게 처음 한 번 띄운다', () => {
        expect(shouldShowSetupNudge(EMPTY_MEMBER_NUDGE_RECORD, ctx)).toBe(true);
    });

    it('보유 종목이 없어도 관심종목이 있으면 띄운다', () => {
        expect(
            shouldShowSetupNudge(EMPTY_MEMBER_NUDGE_RECORD, {
                ...ctx,
                holdingsCount: 0,
                watchlistCount: 1,
            })
        ).toBe(true);
    });

    it('이미 띄웠으면 다시 띄우지 않는다', () => {
        expect(
            shouldShowSetupNudge(
                { ...EMPTY_MEMBER_NUDGE_RECORD, setupShown: true },
                ctx
            )
        ).toBe(false);
    });

    it.each([
        ['이메일 미인증', { ...ctx, emailVerified: false }],
        [
            '보유도 관심종목도 없음',
            { ...ctx, holdingsCount: 0, watchlistCount: 0 },
        ],
        ['이미 수신 중', { ...ctx, reportEnabled: true }],
        ['수신 여부 모름', { ...ctx, reportEnabled: null }],
    ])('%s이면 띄우지 않는다', (_, context) => {
        expect(shouldShowSetupNudge(EMPTY_MEMBER_NUDGE_RECORD, context)).toBe(
            false
        );
    });
});

describe('recordSymbolAnalysis', () => {
    function analyzeTimes(
        record: MemberNudgeRecord,
        symbol: string,
        times: number,
        now: number
    ) {
        let current = record;
        let last = { record, shouldNudge: false };
        for (let i = 0; i < times; i += 1) {
            last = recordSymbolAnalysis(current, symbol, false, now);
            current = last.record;
        }
        return last;
    }

    it(`포트폴리오 밖 종목을 ${SYMBOL_NUDGE_MIN_ANALYSES}번째 분석할 때 띄운다`, () => {
        const before = analyzeTimes(
            EMPTY_MEMBER_NUDGE_RECORD,
            'tsla',
            SYMBOL_NUDGE_MIN_ANALYSES - 1,
            NOW
        );
        expect(before.shouldNudge).toBe(false);

        const at = recordSymbolAnalysis(before.record, 'TSLA', false, NOW);
        expect(at.shouldNudge).toBe(true);
        expect(at.record.symbolCounts).toEqual({
            TSLA: SYMBOL_NUDGE_MIN_ANALYSES,
        });
    });

    it('리포트 대상(보유 또는 관심) 종목은 세지도 띄우지도 않는다', () => {
        const result = recordSymbolAnalysis(
            EMPTY_MEMBER_NUDGE_RECORD,
            'AAPL',
            true,
            NOW
        );
        expect(result).toEqual({
            record: EMPTY_MEMBER_NUDGE_RECORD,
            shouldNudge: false,
        });
    });

    it('이미 넛지한 종목에는 다시 띄우지 않는다', () => {
        const nudged = markSymbolNudged(
            {
                ...EMPTY_MEMBER_NUDGE_RECORD,
                symbolCounts: { TSLA: SYMBOL_NUDGE_MIN_ANALYSES },
            },
            'tsla',
            NOW - SYMBOL_NUDGE_COOLDOWN_MS * 2
        );
        expect(
            recordSymbolAnalysis(nudged, 'TSLA', false, NOW).shouldNudge
        ).toBe(false);
    });

    it('다른 종목도 직전 종목 넛지에서 쿨다운이 지나야 띄운다', () => {
        const base = {
            ...EMPTY_MEMBER_NUDGE_RECORD,
            symbolCounts: { NVDA: SYMBOL_NUDGE_MIN_ANALYSES - 1 },
        };
        const recent = markSymbolNudged(base, 'TSLA', NOW - 1000);
        expect(
            recordSymbolAnalysis(recent, 'NVDA', false, NOW).shouldNudge
        ).toBe(false);

        const old = markSymbolNudged(
            base,
            'TSLA',
            NOW - SYMBOL_NUDGE_COOLDOWN_MS
        );
        expect(recordSymbolAnalysis(old, 'NVDA', false, NOW).shouldNudge).toBe(
            true
        );
    });

    it('넛지 기록은 대문자 심볼과 시각을 남긴다', () => {
        expect(
            markSymbolNudged(EMPTY_MEMBER_NUDGE_RECORD, 'tsla', NOW)
        ).toMatchObject({ symbolsNudged: ['TSLA'], lastSymbolNudgeAt: NOW });
    });
});
