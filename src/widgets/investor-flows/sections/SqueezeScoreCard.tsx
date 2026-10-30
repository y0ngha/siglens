/**
 * 숏스퀴즈 점수 카드(공매도 섹션 맨 위).
 */
import { useTranslations } from 'next-intl';
import type {
    SqueezeRiskComponentId,
    SqueezeRiskScore,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { ComponentRow } from '../ui/squeeze/ComponentRow';
import { LevelBadge } from '../ui/squeeze/LevelBadge';
import { SqueezeSourceNote } from '../ui/squeeze/SqueezeSourceNote';

const HEADING_ID = 'flows-squeeze-heading';

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
    // 구성요소 이름은 하위 네임스페이스 번역자로 부른다(동적 키 — 파일 전체 네임스페이스가 실리지 않게).
    const componentLabel = (id: SqueezeRiskComponentId): string =>
        tComponent(id);
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
                        <LevelBadge level={risk.level} />
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
            <SqueezeSourceNote risk={risk} />
        </div>
    );
}
