import { describe, expect, it } from 'vitest';
import {
    BARS_RESULT_NOTES,
    FUNDAMENTALS_RESULT_NOTES,
} from '@/features/agent-tools/spec/resultNotes';
import { findToolSpec } from './toolSetHarness';

/*
 * core `resultNotes.test.ts`를 옮긴 것이다(본문 그대로). 결과 notes 문구와 그 notes를 가리키는 도구 설명이
 * 이제 둘 다 siglens에 있다.
 */

const barsDescription = findToolSpec('get_bars_indicators')?.description ?? '';
const fundamentalsDescription =
    findToolSpec('get_fundamentals')?.description ?? '';

const barsNotes = {
    ...BARS_RESULT_NOTES,
    dailyOnlyFields: BARS_RESULT_NOTES.dailyOnlyFields('4Hour'),
};

const POINTER =
    '`notes` (when present) say why a field is null in this result and what to do instead.';

describe('BARS_RESULT_NOTES', () => {
    it('dailyOnlyFields names the requested timeframe and the six 1Day-only fields', () => {
        const weekly = BARS_RESULT_NOTES.dailyOnlyFields('1Week');
        expect(weekly).toContain('timeframe 1Week');
        expect(BARS_RESULT_NOTES.dailyOnlyFields('4Hour')).toContain(
            'timeframe 4Hour'
        );
        [
            'calendarChange',
            'closeStreak',
            'maCross50_200',
            'pullback',
            'fearGreed',
            'lastCompletedClose',
        ].forEach(field => expect(weekly).toContain(field));
        expect(weekly).toContain('(null or absent)');
        expect(weekly).toContain(
            'When the question needs one of them, call get_bars_indicators with timeframe 1Day and say the figure is on daily bars; if you cannot, say it is not available on this timeframe'
        );
        expect(weekly).toContain('Never fill one from these bars');
        expect(weekly).toContain('from memory');
        expect(weekly).toContain(
            'When the question does not need them, do not mention them'
        );
    });

    it('closeStreakUnavailable is cause-free, question-conditioned and bans counting it', () => {
        const text = BARS_RESULT_NOTES.closeStreakUnavailable;
        expect(text).toContain('derived.closeStreak is null');
        expect(text).toContain(
            'no streak could be computed from the loaded daily bars'
        );
        expect(text).toContain(
            'If the question asks about consecutive up or down sessions, say the streak cannot be determined'
        );
        expect(text).toContain('never count one yourself');
        expect(text).not.toContain('fewer than 2');
    });

    it('maCrossShortHistory says the data does not reach that far, never that no cross happened', () => {
        const text = BARS_RESULT_NOTES.maCrossShortHistory;
        expect(text).toContain('derived.maCross50_200 is null');
        expect(text).toContain(
            'If the question asks about a golden or dead cross, say the data does not reach that far'
        );
        expect(text).toContain('never say that no cross happened');
    });

    it('fearGreedUnavailable is cause-free, question-conditioned and bans a substitute', () => {
        const text = BARS_RESULT_NOTES.fearGreedUnavailable;
        expect(text).toContain('fearGreed is null');
        expect(text).toContain('could not compute');
        expect(text).not.toContain('too short');
        expect(text).toContain(
            'If the question asks about it, say it is not available'
        );
        expect(text).toContain('never estimate one');
        expect(text).toContain('never substitute the market-wide index');
    });
});

describe('FUNDAMENTALS_RESULT_NOTES', () => {
    it('earningsSessionUnknown is question-conditioned and keeps never-from-memory and the web_search carve-out', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.earningsSessionUnknown;
        expect(text).toContain(
            'If the question asks about that timing, never state it from memory'
        );
        expect(text).toContain(
            "do not cite the company's usual reporting time from memory either"
        );
        expect(text).toContain('when web_search is available');
        expect(text).toContain('could not be confirmed');
        expect(text).not.toContain('no second source disagrees');
    });

    it('secFieldMissing applies when the answer needs the figure and bans the row fallback and computing', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.secFieldMissing;
        expect(text).toContain('SIGLENS has no filed value');
        expect(text).toContain(
            'When the answer needs that figure, say it is not in the filing data'
        );
        expect(text).toContain('fiscal Q4 derived from the 10-K');
        expect(text).toContain('the quarterly EPS is not in the filing');
        expect(text).toContain('never take it from the row fields');
        expect(text).toContain('never compute it');
    });

    it('dividendsNonPayer says it pays none for a dividend question and bans web_search', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.dividendsNonPayer;
        expect(text).toContain('confirmed non-payer');
        expect(text).toContain(
            'for a dividend question say the company pays no dividend'
        );
        expect(text).toContain('do not web_search');
    });

    it('dividendsUnknown searches when available, otherwise says it could not be confirmed', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.dividendsUnknown;
        expect(text).toContain('For a dividend question, search and cite');
        expect(text).toContain('web_search is available');
        expect(text).toContain('could not be confirmed');
        expect(text).toContain('never answer from memory');
        expect(text).toContain('never derive a yield');
    });

    it('dividendsTrailingUnknown reports only the latest payment and bans deriving a yield', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.dividendsTrailingUnknown;
        expect(text).toContain('both null');
        expect(text).toContain(
            'For a dividend question, report only the latest payment'
        );
        expect(text).toContain(
            'trailing-12-month yield could not be confirmed'
        );
        expect(text).toContain('web_search it when available');
        expect(text).toContain('from a single payment');
    });

    it('krYieldOnLastCloseNull labels dartYieldPct, covers the both-null branch and bans computing', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.krYieldOnLastCloseNull;
        expect(text).toContain('For a yield question, quote dartYieldPct');
        expect(text).toContain('record-date price');
        expect(text).toContain('when it is null too');
        expect(text).toContain('Never compute a yield yourself');
    });

    it('krDpsUnknown sends a dividend question to the trailing fields', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.krDpsUnknown;
        expect(text).toContain('dpsCommon is null');
        expect(text).toContain('could not be confirmed');
        expect(text).toContain(
            'For a dividend question, use the trailing fields, never a single payment'
        );
    });

    it('indexMembershipUnknown searches for a membership question and bans memory', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.indexMembershipUnknown;
        expect(text).toContain('For an index-membership question, search');
        expect(text).toContain('web_search is available');
        expect(text).toContain('SIGLENS does not carry it');
        expect(text).toContain('never answer from memory');
    });

    it('peUntrusted says only that no usable figure was returned and bans estimating', () => {
        const text = FUNDAMENTALS_RESULT_NOTES.peUntrusted;
        expect(text).toContain('no usable price-to-earnings figure');
        expect(text).toContain(
            'When the answer needs a P/E, say it is not available'
        );
        expect(text).toContain('never estimate it');
        // DOM-12: a null does not prove why it is null.
        expect(text).not.toMatch(/stale|inconsistent|trustworthy/);
    });
});

describe('result notes are model-facing statements about one result', () => {
    const all = [
        ...Object.values(barsNotes),
        ...Object.values(FUNDAMENTALS_RESULT_NOTES),
    ];

    it('every text is a non-empty single paragraph and the texts are distinct', () => {
        expect(all.every(text => text.trim().length > 0)).toBe(true);
        expect(all.some(text => text.includes('\n'))).toBe(false);
        expect(new Set(all).size).toBe(all.length);
    });

    it('every text says it is about this result', () => {
        expect(all.every(text => /this result/i.test(text))).toBe(true);
    });

    // Both directions, as for get_price_stats: a field a note names is a field
    // the description defines (a rename must reach the note), every key of both
    // note sets has at least one row here, and every field the description
    // sends to `notes` is named by a note.
    const BARS_FIELDS = [
        ['dailyOnlyFields', 'calendarChange'],
        ['dailyOnlyFields', 'closeStreak'],
        ['dailyOnlyFields', 'maCross50_200'],
        ['dailyOnlyFields', 'pullback'],
        ['dailyOnlyFields', 'fearGreed'],
        ['dailyOnlyFields', 'lastCompletedClose'],
        ['closeStreakUnavailable', 'closeStreak'],
        ['maCrossShortHistory', 'maCross50_200'],
        ['fearGreedUnavailable', 'fearGreed'],
    ] as const;
    const FUNDAMENTALS_FIELDS = [
        ['earningsSessionUnknown', 'earningsSession'],
        ['secFieldMissing', 'recentQuarters'],
        ['secFieldMissing', 'sec'],
        ['secFieldMissing', 'epsDiluted'],
        ['dividendsNonPayer', 'dividends'],
        ['dividendsNonPayer', 'latestExDate'],
        ['dividendsNonPayer', 'latestAmount'],
        ['dividendsNonPayer', 'trailing12mAmount'],
        ['dividendsNonPayer', 'trailingYieldPct'],
        ['dividendsUnknown', 'dividends'],
        ['dividendsTrailingUnknown', 'latestExDate'],
        ['dividendsTrailingUnknown', 'trailing12mAmount'],
        ['dividendsTrailingUnknown', 'trailingYieldPct'],
        ['krYieldOnLastCloseNull', 'yieldOnLastClosePct'],
        ['krYieldOnLastCloseNull', 'dartYieldPct'],
        ['krDpsUnknown', 'dpsCommon'],
        ['indexMembershipUnknown', 'indexMemberships'],
        // The description names the ratio as "P/E" (the result's own key is
        // the consumer's); the note must use the same name.
        ['peUntrusted', 'P/E'],
    ] as const;

    it.each(BARS_FIELDS)(
        'bars note %s names %s, and the description defines it',
        (key, field) => {
            expect(barsNotes[key]).toContain(field);
            expect(barsDescription).toContain(field);
        }
    );

    it.each(FUNDAMENTALS_FIELDS)(
        'fundamentals note %s names %s, and the description defines it',
        (key, field) => {
            expect(FUNDAMENTALS_RESULT_NOTES[key]).toContain(field);
            expect(fundamentalsDescription).toContain(field);
        }
    );

    it('every note key has at least one field row', () => {
        const covered = (rows: readonly (readonly [string, string])[]) =>
            new Set(rows.map(([key]) => key));
        expect(
            Object.keys(BARS_RESULT_NOTES).filter(
                key => !covered(BARS_FIELDS).has(key)
            )
        ).toEqual([]);
        expect(
            Object.keys(FUNDAMENTALS_RESULT_NOTES).filter(
                key => !covered(FUNDAMENTALS_FIELDS).has(key)
            )
        ).toEqual([]);
    });

    it('each description carries the notes pointer sentence', () => {
        expect(barsDescription).toContain(POINTER);
        expect(fundamentalsDescription).toContain(POINTER);
    });

    // The two `sentToNotes` lists are maintained by hand on purpose: they are
    // the fields each description defers to `notes`, and a new deferral has to
    // be added here deliberately so a note exists for it.
    it('every null-capable field the bars description sends to notes is named by a note', () => {
        const sentToNotes = [
            'closeStreak',
            'maCross50_200',
            'fearGreed',
            'calendarChange',
            'lastCompletedClose',
            'pullback',
        ];
        const noteTexts = Object.values(barsNotes);
        expect(
            sentToNotes.filter(
                field =>
                    !barsDescription.includes(field) ||
                    !noteTexts.some(text => text.includes(field))
            )
        ).toEqual([]);
    });

    it('every null-capable field the fundamentals description sends to notes is named by a note', () => {
        const sentToNotes = [
            'earningsSession',
            'dividends',
            'annualReported',
            'yieldOnLastClosePct',
            'dpsCommon',
            'indexMemberships',
            'P/E',
        ];
        const noteTexts = Object.values(FUNDAMENTALS_RESULT_NOTES);
        expect(
            sentToNotes.filter(
                field =>
                    !fundamentalsDescription.includes(field) ||
                    !noteTexts.some(text => text.includes(field))
            )
        ).toEqual([]);
    });
});
