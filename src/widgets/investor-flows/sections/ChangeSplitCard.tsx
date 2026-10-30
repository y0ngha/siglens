/**
 * 기관 4분할 카드 — 신규 진입·지분 증가·지분 감소·완전 청산 기관 수와 직전 분기 대비 증감.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip, type FlowTerm } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import {
    splitDeltaKind,
    type SplitComparison,
    type SplitDeltaKind,
    type SplitKey,
} from '../utils/institutional';

const LABEL_KEY: Record<SplitKey, string> = {
    newHolders: 'newHolders',
    increased: 'increased',
    decreased: 'decreased',
    exited: 'exited',
};

const TERM: Record<SplitKey, FlowTerm> = {
    newHolders: 'newExited',
    increased: 'increasedDecreased',
    decreased: 'increasedDecreased',
    exited: 'newExited',
};

/** 들어오는 쪽(신규·증가)은 IN, 나가는 쪽(감소·청산)은 OUT 색 — 글자(IN/OUT 표기)와 함께 쓴다. */
const VALUE_CLASS: Record<SplitKey, string> = {
    newHolders: 'text-ui-success-text',
    increased: 'text-ui-success-text',
    decreased: 'text-ui-danger-text',
    exited: 'text-ui-danger-text',
};

const DELTA_MARK: Record<SplitDeltaKind, string> = {
    none: '',
    flat: '',
    up: '▲ ',
    down: '▼ ',
};

/** 직전 분기 대비 증감 문구. 문구는 종류별로 한 번에 만들어 두고(리터럴 번역 호출) 종류로 고른다. */
function SplitDelta({ delta }: { readonly delta: number | null }) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const kind = splitDeltaKind(delta);
    const amount = formatInteger(Math.abs(delta ?? 0), locale);
    const texts: Record<SplitDeltaKind, string> = {
        none: t('split.noPrevious'),
        flat: t('split.deltaFlat'),
        up: t('split.deltaUp', { delta: amount }),
        down: t('split.deltaDown', { delta: amount }),
    };
    return (
        <>
            <span aria-hidden="true">{DELTA_MARK[kind]}</span>
            {texts[kind]}
        </>
    );
}

interface ChangeSplitCardProps {
    readonly comparison: SplitComparison;
}

/**
 * "신규 진입 n · 지분 증가 n · 지분 감소 n · 완전 청산 n" 4분할 카드 — 기준 분기의 기관 수와, 직전 분기
 * 대비 늘고 준 만큼(▲▼ + 부호 + 글자). 증감 화살표에는 좋고 나쁨의 색을 싣지 않는다(`DESIGN.md#DS-15`):
 * 청산이 늘었다고 "나쁨"이 아니라 "OUT 쪽이 늘었다"는 사실만 전한다.
 */
export function ChangeSplitCard({ comparison }: ChangeSplitCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const tSplit = useTranslations('widgets.investor-flows.split');
    const locale = useResolvedLocale();
    return (
        <div>
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('split.title')}
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {comparison.previousPeriod === null
                    ? t('split.basisNoPrevious', { period: comparison.period })
                    : t('split.basis', {
                          period: comparison.period,
                          previous: comparison.previousPeriod,
                      })}
            </p>
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {comparison.metrics.map(metric => (
                    <li key={metric.key} className={cn(SURFACE_NESTED, 'p-3')}>
                        <p className="text-xs text-secondary-300">
                            {tSplit(LABEL_KEY[metric.key])}
                            <FlowTooltip term={TERM[metric.key]} />
                        </p>
                        <p
                            className={cn(
                                'mt-1 text-xl font-semibold tabular-nums',
                                VALUE_CLASS[metric.key]
                            )}
                        >
                            {t('split.count', {
                                count: formatInteger(metric.value, locale),
                            })}
                        </p>
                        <p className="mt-1 text-xs text-secondary-300 tabular-nums">
                            <SplitDelta delta={metric.delta} />
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
