import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type {
    SqueezeRiskComponent,
    SqueezeRiskComponentId,
    SqueezeRiskLevel,
    SqueezeRiskScore,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import {
    formatComponentValue,
    SQUEEZE_LEVEL_CLASS,
    SQUEEZE_LEVEL_MARK,
} from '../utils/squeeze';

const HEADING_ID = 'flows-squeeze-heading';

function ComponentRow({
    component,
    label,
}: {
    readonly component: SqueezeRiskComponent;
    readonly label: string;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { unit, value } = formatComponentValue(
        component.id,
        component.value,
        locale
    );
    // 퍼센트 값은 포맷이 이미 `%`를 붙인다. 나머지 단위 글자는 로케일마다 다르다.
    const unitLabels = {
        percent: value,
        signedPercent: value,
        days: t('squeeze.unit.days', { value }),
        tradingDays: t('squeeze.unit.tradingDays', { value }),
        notListed: t('squeeze.unit.notListed'),
        z: t('squeeze.unit.z', { value }),
        multiple: t('squeeze.unit.multiple', { value }),
    };
    // 안전한 캐스트: 값은 이 파일이 만든 `%` 문자열 하나뿐이다(TW-1 — 동적 폭은 CSS 변수로).
    const barStyle = {
        '--bar-w': `${Math.round(Math.min(1, Math.max(0, component.normalized)) * 100)}%`,
    } as CSSProperties;
    return (
        <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="min-w-0 text-xs text-secondary-300">
                {label}
                <span className="ml-1 text-secondary-400 tabular-nums">
                    {unitLabels[unit]}
                </span>
            </span>
            <span className="text-xs text-secondary-200 tabular-nums">
                {t('squeeze.points', {
                    points: formatInteger(component.contribution, locale),
                })}
            </span>
            <span
                aria-hidden="true"
                className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary-700"
            >
                <span
                    style={barStyle}
                    className="block h-full w-(--bar-w) rounded-full bg-primary-400"
                />
            </span>
        </li>
    );
}

interface SqueezeScoreCardProps {
    readonly risk: SqueezeRiskScore;
}

/**
 * 숏스퀴즈 점수 카드(공매도 섹션 맨 위). 점수·수준·구성요소는 core `evaluateSqueezeRisk` 결과를 그대로 옮긴다 — 화면이 다시
 * 계산하지 않는다. 수준은 색 + 막대 기호(▮) + 글자 세 겹으로 전하고, 구성요소마다 0~1 정규화 값의 막대와 점수 기여분을 보인다.
 *
 * 빠진 입력이 있으면(`partial`) 남은 입력으로 비율을 다시 맞췄다고 밝히고, 공매도 포지션 입력이 없어 수준이 묶였으면
 * (`levelCapped`) 그것도 적는다. 공매도 쪽 입력이 하나도 없으면(`insufficient`) 점수를 내지 않았다고 말한다.
 */
export function SqueezeScoreCard({ risk }: SqueezeScoreCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const tComponent = useTranslations(
        'widgets.investor-flows.squeeze.component'
    );
    const locale = useResolvedLocale();
    const levelLabels: Record<SqueezeRiskLevel, string> = {
        low: t('squeeze.level.low'),
        elevated: t('squeeze.level.elevated'),
        high: t('squeeze.level.high'),
        extreme: t('squeeze.level.extreme'),
    };
    // 구성요소 이름은 하위 네임스페이스 번역자로 부른다(동적 키 — 파일 전체 네임스페이스가 실리지 않게).
    const componentLabel = (id: SqueezeRiskComponentId): string =>
        tComponent(id);
    const sources = [
        ...(risk.includesFinra ? [t('squeeze.sourceFinra')] : []),
        ...(risk.components.some(c => c.id === 'fails_to_deliver_pct')
            ? [t('squeeze.sourceSec')]
            : []),
        ...(risk.includesExchangeLists ? [t('squeeze.sourceExchange')] : []),
        ...(risk.lastBarDate === null ? [] : [t('squeeze.sourcePrice')]),
    ];
    return (
        <div
            role="group"
            aria-labelledby={HEADING_ID}
            data-testid="flows-squeeze-card"
            className={cn(SURFACE_NESTED, 'space-y-3 p-4')}
        >
            <h3 id={HEADING_ID} className={HEADING_SUBSECTION}>
                {t('squeeze.title')}
                <FlowTooltip term="squeezeScore" />
            </h3>
            {risk.score === null || risk.level === null ? (
                <p className="text-sm text-secondary-300">
                    {t('squeeze.insufficient')}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="text-3xl font-semibold text-secondary-100 tabular-nums">
                            {t('squeeze.score', {
                                score: formatInteger(risk.score, locale),
                            })}
                        </p>
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                                SQUEEZE_LEVEL_CLASS[risk.level]
                            )}
                        >
                            <span aria-hidden="true">
                                {SQUEEZE_LEVEL_MARK[risk.level]}
                            </span>
                            {levelLabels[risk.level]}
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {risk.components.map(component => (
                            <ComponentRow
                                key={component.id}
                                component={component}
                                label={componentLabel(component.id)}
                            />
                        ))}
                    </ul>
                    {risk.sufficiency === 'partial' && (
                        <p className="text-xs text-secondary-400">
                            {t('squeeze.partial', {
                                count: formatInteger(
                                    risk.missing.length,
                                    locale
                                ),
                            })}
                        </p>
                    )}
                    {risk.levelCapped && (
                        <p className="text-xs text-secondary-400">
                            {t('squeeze.capped')}
                        </p>
                    )}
                </>
            )}
            <p className="text-xs text-secondary-400">
                {risk.lastBarDate === null
                    ? t('squeeze.sources', { sources: sources.join(' · ') })
                    : t('squeeze.sourcesWithPrice', {
                          sources: sources.join(' · '),
                          date: risk.lastBarDate,
                      })}
            </p>
        </div>
    );
}
