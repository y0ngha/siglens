import { useTranslations } from 'next-intl';
import {
    ECONOMY_CATEGORY_LABEL_KEY,
    ECONOMY_INDICATOR_LABEL_KEY,
} from '@/shared/config/economyLabelKey';
import type { KrIndicatorCard } from '@/entities/economy';
import {
    ECONOMY_INDICATOR_CATEGORIES,
    type EconomyCategoryKey,
} from '@/shared/config/economyIndicators';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

interface KrEconomicIndicatorGridProps {
    readonly cards: readonly KrIndicatorCard[];
}

/**
 * 한국 거시 지표 카드 그리드.
 *
 * 미국판(`EconomicIndicatorGrid`)과 별도 컴포넌트인 이유: 입력 형상이 다르다.
 * 미국은 core가 정규화한 `EconomySnapshot`(지표 시계열 + 국채 스냅샷)을 받지만,
 * 한국은 캘린더 발표 이력에서 되짚은 `KrIndicatorCard[]`다. 하나의 컴포넌트로
 * 두 형상을 받으려면 유니온 분기가 렌더 전체에 퍼져, 두 벌을 두는 것보다 읽기
 * 어려워진다. 카테고리 섹션 구성과 카드 조판은 같은 규칙을 따른다.
 *
 * 서버 컴포넌트 — 상태가 없다.
 */
export function KrEconomicIndicatorGrid({
    cards,
}: KrEconomicIndicatorGridProps) {
    const tCfg = useTranslations('shared.config');
    const t = useTranslations('widgets.economy');
    if (cards.length === 0) return null;

    const byCategory = new Map<EconomyCategoryKey, KrIndicatorCard[]>();
    for (const card of cards) {
        const bucket = byCategory.get(card.meta.category);
        if (bucket) bucket.push(card);
        else byCategory.set(card.meta.category, [card]);
    }

    return (
        <section aria-labelledby="kr-economy-indicators" className="space-y-5">
            <h2
                id="kr-economy-indicators"
                className="text-base font-semibold text-secondary-200"
            >
                {t('KrEconomicIndicatorGrid.c2a5bf')}
            </h2>
            {ECONOMY_INDICATOR_CATEGORIES.map(category => {
                const items = byCategory.get(category.key);
                // 발표 이력이 아직 없는 카테고리는 제목만 남은 빈 섹션이 된다.
                if (!items || items.length === 0) return null;
                return (
                    <div key={category.key} className="space-y-2">
                        <h3 className="text-sm font-medium text-secondary-400">
                            {tCfg(
                                ECONOMY_CATEGORY_LABEL_KEY[category.key] ??
                                    category.label
                            )}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map(card => (
                                <IndicatorCard
                                    key={card.meta.event}
                                    card={card}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}

interface IndicatorCardProps {
    readonly card: KrIndicatorCard;
}

function IndicatorCard({ card }: IndicatorCardProps) {
    const tCfg = useTranslations('shared.config');
    const t = useTranslations('widgets.economy');
    const { meta, latest, latestDate, changeFromPrevious } = card;
    return (
        <article className="rounded-lg border border-secondary-800 bg-secondary-800/30 p-4">
            <div className="flex items-center gap-1.5">
                <h4 className="text-sm text-secondary-400">
                    {ECONOMY_INDICATOR_LABEL_KEY[meta.label]
                        ? tCfg(ECONOMY_INDICATOR_LABEL_KEY[meta.label])
                        : meta.label}
                </h4>
                <InfoTooltip>{meta.tooltip}</InfoTooltip>
            </div>
            <p className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-secondary-100">
                    {latest.toFixed(meta.precision)}
                </span>
                <span className="text-xs text-secondary-400">{meta.unit}</span>
            </p>
            {changeFromPrevious !== null && (
                <p
                    className={cn(
                        'mt-1 text-xs',
                        changeFromPrevious > 0
                            ? 'text-ui-danger'
                            : changeFromPrevious < 0
                              ? 'text-ui-success'
                              : 'text-secondary-400'
                    )}
                >
                    {/*
                        색은 "좋다/나쁘다"가 아니라 방향만 뜻한다 — 실업률이 오르면
                        나쁘고 성장률이 오르면 좋은데, 지표마다 방향의 의미가 달라
                        해석까지 색으로 단정하지 않는다. 상승=적색은 국내 증시
                        관행(상승 적색)과 같은 방향이라 오독이 적다.
                    */}
                    {t('KrEconomicIndicatorGrid.9fc30a', {
                        v0: changeFromPrevious > 0 ? '+' : '',
                        v1: changeFromPrevious.toFixed(meta.precision),
                        v2: meta.unit,
                    })}
                </p>
            )}
            <p className="mt-1 text-xs text-secondary-500">{latestDate}</p>
        </article>
    );
}
