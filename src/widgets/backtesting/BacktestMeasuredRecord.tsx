import { useFormatter, useTranslations } from 'next-intl';
import {
    CANDLE_OUTCOME_BARS,
    CANDLE_POOLED_BASE_RATE,
    type MeasuredBaseRate,
} from '@y0ngha/siglens-core';
import { BACKTEST_RECORD_ID } from '@/shared/lib/backtestRecordPath';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import {
    MeasuredRecordTable,
    type MeasuredRecordTableRow,
} from './ui/record/MeasuredRecordTable';
import {
    levelRecord,
    patternRecord,
    patternSkillName,
    type MeasuredRecordRow,
} from './utils/measuredRecordRows';

/**
 * 구역마다 측정 범위 한 줄을 그 구역 행의 `scope`에서 읽는다(리터럴 금지). 한 표의 행은 같은
 * 범위로 쟀으므로 첫 행의 값을 쓰고, 범위가 갈라지면 테스트가 잡는다.
 */
function firstScope(
    rates: readonly (MeasuredBaseRate | null)[]
): MeasuredBaseRate['scope'] | null {
    return rates.find(rate => rate !== null)?.scope ?? null;
}

/**
 * `/backtesting#record` — 시그렌즈가 분석에 쓰는 패턴, 캔들, 가격대의 과거 측정 기록.
 *
 * 값은 전부 core의 측정 상수를 그대로 읽고 다시 계산하지 않는다. 패턴 표는
 * `PATTERN_BASE_RATES`(자기 표본이 있는 패턴)와 `PATTERN_POOLED_BASE_RATE`(전체 패턴 합산), 캔들
 * 표는 `CANDLE_POOLED_BASE_RATE`, 가격대 표는 유형별 `PRICE_LEVEL_FAMILY_BASE_RATES`(접근자
 * `priceLevelFamilyBaseRateFor`로만)와 `PRICE_LEVEL_BASE_RATE`(전체 합산)다. 재는 것은 셋이다:
 * 패턴은 목표 가격이 무효화 가격보다 먼저 닿은 비율, 가격대는 닿은 뒤 지켜진 비율, 캔들은 그 뒤
 * 며칠 동안 캔들이 가리킨 방향으로 움직인 비율이며 각각 같은 종목의 다른 날과 나란히 싣는다.
 * 수익률은 싣지 않는다. 행은 상수의 키 순서이며 비율로 정렬하지 않는다. 가격대 유형 행은
 * 접근자로만 읽어서, 표본이 적어 합산 값을 물려받은 유형이 자기 측정처럼 보이지 않게 한다.
 */
export function BacktestMeasuredRecord() {
    const t = useTranslations('widgets.backtesting.record');
    const format = useFormatter();
    const skillLabel = useSkillLabel();

    const levelLabels: Readonly<Record<string, string>> = {
        avwap: t('levelFamily.avwap'),
        band: t('levelFamily.band'),
        fib: t('levelFamily.fib'),
        ichimoku: t('levelFamily.ichimoku'),
        ma: t('levelFamily.ma'),
        pivot: t('levelFamily.pivot'),
        round: t('levelFamily.round'),
        supertrend: t('levelFamily.supertrend'),
        swing: t('levelFamily.swing'),
        vp: t('levelFamily.vp'),
        vwap: t('levelFamily.vwap'),
    };
    // 패턴 이름은 분석 카드와 같은 스킬 표시명이다.
    const patternName = (id: string): string =>
        skillLabel(patternSkillName(id));
    // 이름 표가 없는 새 id는 id 그대로 보여 준다 — 행을 빠뜨리는 쪽이 더 나쁘다.
    const nameOf = (
        labels: Readonly<Record<string, string>>,
        id: string
    ): string => labels[id] ?? id;
    const toRow =
        (labels: Readonly<Record<string, string>>) =>
        ({ id, rate }: MeasuredRecordRow): MeasuredRecordTableRow => ({
            id,
            label: nameOf(labels, id),
            rate,
        });

    const patterns = patternRecord();
    const patternRows: MeasuredRecordTableRow[] = [
        ...patterns.own.map(({ id, rate }) => ({
            id,
            label: patternName(id),
            rate,
        })),
        {
            id: 'pooled',
            label: t('pooledPatterns'),
            rate: patterns.pooled,
            // 대신하는 패턴이 있을 때만 그 사실을 밝힌다.
            note:
                patterns.pooledIds.length > 0
                    ? t('pooledPatternsNote', {
                          names: format.list(
                              patterns.pooledIds.map(patternName),
                              { type: 'conjunction' }
                          ),
                      })
                    : undefined,
        },
    ];

    const candleRows: MeasuredRecordTableRow[] = [
        {
            id: 'candles',
            label: t('candlesAll'),
            rate: CANDLE_POOLED_BASE_RATE,
        },
    ];

    const levels = levelRecord();
    const levelRows: MeasuredRecordTableRow[] = [
        ...levels.families.map(toRow(levelLabels)),
        { id: 'pooled', label: t('levelsAll'), rate: levels.pooled },
    ];

    const sections = [
        {
            id: 'patterns',
            kind: 'pattern' as const,
            heading: t('patternsHeading'),
            definition: t('patternsDefinition'),
            nameHeader: t('patternsName'),
            region: t('patternsRegion'),
            rows: patternRows,
            scope: firstScope(patternRows.map(row => row.rate)),
        },
        {
            id: 'candles',
            kind: 'candle' as const,
            heading: t('candlesHeading'),
            definition: t('candlesDefinition', { bars: CANDLE_OUTCOME_BARS }),
            nameHeader: t('candlesName'),
            region: t('candlesRegion'),
            rows: candleRows,
            scope: firstScope(candleRows.map(row => row.rate)),
        },
        {
            id: 'levels',
            kind: 'level' as const,
            heading: t('levelsHeading'),
            definition: t('levelsDefinition'),
            nameHeader: t('levelsName'),
            region: t('levelsRegion'),
            rows: levelRows,
            scope: firstScope(levelRows.map(row => row.rate)),
        },
    ];

    return (
        <section
            id={BACKTEST_RECORD_ID}
            aria-labelledby="backtest-record-heading"
            className="page-container scroll-mt-20 py-6"
        >
            <div className={cn(SURFACE_CARD, 'px-4 py-5 sm:px-6')}>
                <h2
                    id="backtest-record-heading"
                    className={cn(HEADING_SECTION, 'mb-2')}
                >
                    {t('heading')}
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-pretty text-secondary-400">
                    {t('intro', { bars: CANDLE_OUTCOME_BARS })}
                </p>
                <div className="flex flex-col gap-6">
                    {sections.map(section => (
                        <div key={section.id}>
                            <h3 className={cn(HEADING_SUBSECTION, 'mb-1')}>
                                {section.heading}
                            </h3>
                            <p className="text-sm leading-relaxed text-pretty text-secondary-400">
                                {section.definition}
                            </p>
                            {section.scope !== null && (
                                <p className="mb-3 text-sm leading-relaxed text-pretty text-secondary-400">
                                    {t('scope', {
                                        symbols: section.scope.symbols,
                                        from: section.scope.from,
                                        to: section.scope.to,
                                    })}
                                </p>
                            )}
                            <MeasuredRecordTable
                                kind={section.kind}
                                regionLabel={section.region}
                                nameHeader={section.nameHeader}
                                rows={section.rows}
                            />
                        </div>
                    ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-pretty text-secondary-400">
                    {t('caution')}
                </p>
            </div>
        </section>
    );
}
