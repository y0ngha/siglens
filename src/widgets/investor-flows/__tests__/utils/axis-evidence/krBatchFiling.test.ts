import { describe, expect, it } from 'vitest';
import { buildAxisEvidence } from '../../../utils/axisEvidence';
import {
    batchFilingNote,
    KR_BATCH_FILING_MIN_COUNT,
    KR_BATCH_FILING_MIN_SHARE,
} from '../../../utils/axis-evidence/krBatchFiling';
import {
    evaluate,
    makeKrInsiderRecord,
    makeKrSnapshot,
} from '../../fixtures/flowsFixtures';

describe('임원: 하루 일괄 보고 주석', () => {
    const DATE = '2026-07-21';
    const MIN = KR_BATCH_FILING_MIN_COUNT;

    function reportsLine(
        reports: number,
        filing: { date: string; count: number } | null | undefined,
        locale: 'ko' | 'en' = 'ko'
    ) {
        const base = evaluate(makeKrSnapshot());
        const { largestSingleDayFiling: _omit, ...rest } =
            base.insider.krMetrics!;
        const scorecard = {
            ...base,
            insider: {
                ...base.insider,
                krMetrics:
                    filing === undefined
                        ? { ...rest, reports }
                        : { ...rest, reports, largestSingleDayFiling: filing },
            },
        };
        return buildAxisEvidence(scorecard, 'insider', locale).find(l =>
            l.id.startsWith('krInsiderReports')
        )!;
    }

    it('큰 비중의 하루 일괄 보고면 날짜·건수를 담은 줄로 바꾼다', () => {
        const line = reportsLine(800, { date: DATE, count: 742 });
        expect(line.id).toBe('krInsiderReportsBatch');
        expect(line.values).toMatchObject({
            reports: '800',
            date: '7월 21일',
            batchCount: '742',
        });
    });

    it('en: 날짜는 월 이름이고 1,000건 이상은 자릿점이 붙는다', () => {
        const line = reportsLine(1_500, { date: DATE, count: 1_200 }, 'en');
        expect(line.values).toMatchObject({
            reports: '1,500',
            date: 'Jul 21',
            batchCount: '1,200',
        });
    });

    it('건수 하한 경계: 하한은 주석, 하한-1은 없음', () => {
        expect(reportsLine(MIN + 10, { date: DATE, count: MIN }).id).toBe(
            'krInsiderReportsBatch'
        );
        expect(reportsLine(MIN + 10, { date: DATE, count: MIN - 1 }).id).toBe(
            'krInsiderReports'
        );
    });

    it('비중 경계: 정확히 절반은 주석, 그 미만은 없음', () => {
        const reports = 800;
        const half = reports * KR_BATCH_FILING_MIN_SHARE;
        expect(reportsLine(reports, { date: DATE, count: half }).id).toBe(
            'krInsiderReportsBatch'
        );
        expect(reportsLine(reports, { date: DATE, count: half - 1 }).id).toBe(
            'krInsiderReports'
        );
    });

    it('건수 하한과 비중 경계가 겹쳐도 주석을 낸다', () => {
        const reports = MIN / KR_BATCH_FILING_MIN_SHARE;
        expect(reportsLine(reports, { date: DATE, count: MIN }).id).toBe(
            'krInsiderReportsBatch'
        );
    });

    it('null이거나 필드가 없으면 주석을 내지 않는다', () => {
        expect(reportsLine(800, null).id).toBe('krInsiderReports');
        expect(reportsLine(800, undefined).id).toBe('krInsiderReports');
    });

    it('batchFilingNote: 보고 0건·전체보다 큰 건수·잘못된 날짜는 null이다', () => {
        const ok = {
            reports: 100,
            largestSingleDayFiling: { date: DATE, count: 60 },
        };
        expect(batchFilingNote(ok, 'ko')).not.toBeNull();
        expect(batchFilingNote({ ...ok, reports: 0 }, 'ko')).toBeNull();
        expect(
            batchFilingNote(
                {
                    reports: 50,
                    largestSingleDayFiling: { date: DATE, count: 60 },
                },
                'ko'
            )
        ).toBeNull();
        for (const date of ['2026-xx-21', '2026-13-01', '2026-02-30', '7/21']) {
            expect(
                batchFilingNote(
                    { ...ok, largestSingleDayFiling: { date, count: 60 } },
                    'ko'
                )
            ).toBeNull();
        }
    });

    it('core 평가기가 만든 largestSingleDayFiling으로도 주석이 난다', () => {
        const insiderReports = Array.from({ length: MIN + 5 }, (_, i) =>
            makeKrInsiderRecord({
                rceptNo: `2026101300${String(1000 + i)}`,
                reporter: `보고자${i}`,
            })
        );
        const scorecard = evaluate(makeKrSnapshot({ insiderReports }));
        expect(scorecard.insider.krMetrics?.largestSingleDayFiling).toEqual({
            date: '2026-10-13',
            count: MIN + 5,
        });
        const line = buildAxisEvidence(scorecard, 'insider', 'en').find(l =>
            l.id.startsWith('krInsiderReports')
        );
        expect(line?.id).toBe('krInsiderReportsBatch');
        expect(line?.values.date).toBe('Oct 13');
    });
});
