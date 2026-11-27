import { useTranslations } from 'next-intl';
import type { MeasuredBaseRate } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatShareAsPercent } from '@/shared/lib/patternBaseRate';

export interface MeasuredRecordTableRow {
    readonly id: string;
    readonly label: string;
    /** `null`이면 자기 측정이 없는 행이라 비율 없이 표본 부족 문구만 적는다. */
    readonly rate: MeasuredBaseRate | null;
    /** 라벨 아래 한 줄 보충(합산 행이 왜 합산인지). */
    readonly note?: string;
}

/** 표가 무엇을 비교했는지. 비교 대상 문구(같은 거리의 다른 날 / 같은 종목의 다른 날)가 갈린다. */
export type MeasuredRecordKind = 'pattern' | 'candle' | 'level';

interface MeasuredRecordTableProps {
    readonly kind: MeasuredRecordKind;
    /** 스크롤 영역과 표를 가리키는 이름. */
    readonly regionLabel: string;
    /** 첫 열 머리글(패턴, 캔들, 가격대 유형). */
    readonly nameHeader: string;
    readonly rows: readonly MeasuredRecordTableRow[];
}

const HEAD_CELL = 'px-3 py-2 text-left font-medium';
const CELL = 'px-3 py-2 align-top';

/**
 * 측정 기록 표 한 장. 행마다 "{p}% ({n}건), 비교 대상 {q}%"와 판정 문장 하나를 적는다. 숫자는
 * `MeasuredBaseRate`의 필드 그대로다. 판정은 세 값 모두 규칙대로 문장이 정해진다:
 * `beats_placebo`는 "더 자주", `no_edge`는 "측정된 우위 없음", `insufficient_sample`은 비율을
 * 싣지 않고 표본 부족만 밝힌다(표본이 모자란 비율은 보여 주지 않는다). 자기 측정이 없는 행
 * (`rate === null`)도 같은 표본 부족 문장이다. 좁은 화면에서는 표만 가로로 스크롤한다.
 */
export function MeasuredRecordTable({
    kind,
    regionLabel,
    nameHeader,
    rows,
}: MeasuredRecordTableProps) {
    const t = useTranslations('widgets.backtesting.record');
    const tRate = useTranslations('widgets.analysis.baseRate');
    // 캔들의 위약은 같은 거리가 아니라 같은 종목의 다른 날이라 행·판정 문구가 따로다.
    const formatRow = (rate: MeasuredBaseRate): string => {
        const values = {
            event: formatShareAsPercent(rate.eventShare),
            n: rate.n,
            placebo: formatShareAsPercent(rate.placeboShare),
        };
        return kind === 'candle' ? t('candleRow', values) : t('row', values);
    };
    const verdictText = (verdict: 'beats_placebo' | 'no_edge'): string => {
        if (kind === 'candle') {
            return verdict === 'beats_placebo'
                ? t('candleVerdictBeats')
                : t('candleVerdictNoEdge');
        }
        return verdict === 'beats_placebo'
            ? tRate('verdictBeats')
            : tRate('verdictNoEdge');
    };

    return (
        <div
            role="region"
            tabIndex={0}
            aria-label={regionLabel}
            className="-mx-4 overflow-x-auto px-4 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:mx-0 sm:px-0"
        >
            <table className="w-full min-w-[32rem] text-sm text-secondary-300">
                <thead className="text-xs text-secondary-400">
                    <tr>
                        <th scope="col" className={HEAD_CELL}>
                            {nameHeader}
                        </th>
                        <th scope="col" className={HEAD_CELL}>
                            {t('colResult')}
                        </th>
                        <th scope="col" className={HEAD_CELL}>
                            {t('colVerdict')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ id, label, rate, note }) => (
                        <tr
                            key={id}
                            className="border-t border-secondary-700/60"
                        >
                            <th
                                scope="row"
                                className={cn(
                                    CELL,
                                    'text-left font-medium text-secondary-200'
                                )}
                            >
                                {label}
                                {note !== undefined && (
                                    <span className="mt-0.5 block text-xs font-normal text-secondary-400">
                                        {note}
                                    </span>
                                )}
                            </th>
                            {rate === null ||
                            rate.verdict === 'insufficient_sample' ? (
                                <td colSpan={2} className={CELL}>
                                    {t('insufficient')}
                                </td>
                            ) : (
                                <>
                                    <td className={cn(CELL, 'tabular-nums')}>
                                        {formatRow(rate)}
                                    </td>
                                    <td className={CELL}>
                                        {verdictText(rate.verdict)}
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
