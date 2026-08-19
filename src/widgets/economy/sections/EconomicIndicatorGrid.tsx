import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import {
    computeYieldSpread,
    type EconomicIndicatorSeries,
    type EconomySnapshot,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';

import {
    ECONOMY_INDICATOR_CATEGORIES,
    ECONOMY_INDICATORS,
    type EconomyCategoryKey,
    type EconomyIndicatorMeta,
} from '@/shared/config/economyIndicators';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

/**
 * 국채 수익률·2s10s 스프레드 카드의 표시 소수 자리수.
 * 레지스트리 지표는 `meta.precision`을 따르지만, 국채 카드는 레지스트리 외 도메인이라
 * 모듈 상수로 별도 관리한다(MISTAKES §15 매직 넘버 추출).
 */
const TREASURY_YIELD_PRECISION = 2;

interface TreasuryCardMeta {
    label: string;
    tooltip: string;
    unit: string;
}

/**
 * 만기별 국채 수익률 카드의 표시 메타.
 * 인라인 삼항 대신 레코드로 추출해 새 만기 추가 시 단일 위치만 수정한다.
 */
export const TREASURY_CARD_META: Record<'year2' | 'year10', TreasuryCardMeta> =
    {
        year2: {
            label: '2년물 국채',
            tooltip:
                '미국 정부가 발행하는 2년 만기 국채의 수익률이에요. 단기 시장금리의 기준이에요.',
            unit: '%',
        },
        year10: {
            label: '10년물 국채',
            tooltip:
                '미국 정부가 발행하는 10년 만기 국채의 수익률이에요. 장기 시장금리와 모기지 금리의 기준이에요.',
            unit: '%',
        },
    };

interface EconomicIndicatorGridProps {
    snapshot: EconomySnapshot;
}

interface CategorySectionProps {
    category: EconomyCategoryKey;
    label: string;
    seriesByName: Map<string, EconomicIndicatorSeries>;
    treasury: TreasuryRateSnapshot | null;
}

interface IndicatorCardProps {
    meta: EconomyIndicatorMeta;
    series: EconomicIndicatorSeries;
}

interface TreasuryYieldCardProps {
    snapshot: TreasuryRateSnapshot;
    maturity: 'year2' | 'year10';
}

interface YieldSpreadCardProps {
    snapshot: TreasuryRateSnapshot;
}

interface DeltaBadgeProps {
    delta: number;
    precision: number;
    unit: string;
}

/**
 * 카테고리 섹션 4종(금리·물가·성장·고용) 그리드 — 평면 5카드가 아닌 그룹.
 *
 * 각 카드는 레지스트리 메타(라벨·단위·precision·tooltip)로 렌더된다. latest가 null인
 * 지표는 graceful omission(카드 자체 미렌더). 금리 섹션은 2s10s 스프레드 파생 카드를
 * 추가로 표시(`computeYieldSpread`)해 거시 국면 진단의 핵심 신호를 노출.
 *
 * 서버 컴포넌트(use client 미선언) — SSR 텍스트로 검색 엔진이 읽을 수 있다.
 */
export function EconomicIndicatorGrid({
    snapshot,
}: EconomicIndicatorGridProps) {
    const t = useTranslations('widgets.economy');
    const seriesByName = new Map(
        // Map 생성자는 [K, V][] 튜플을 요구하지만 map 결과는 (string|Series)[] 배열로
        // 추론된다 — as const로 튜플 고정해 키/값 타입 보장.
        snapshot.indicators.map(s => [s.name, s] as const)
    );

    return (
        <section
            aria-labelledby="economy-indicators-heading"
            className="space-y-8"
        >
            <h2
                id="economy-indicators-heading"
                className="text-lg font-semibold text-secondary-100"
            >
                {t('EconomicIndicatorGrid.c2a5bf')}
            </h2>
            {ECONOMY_INDICATOR_CATEGORIES.map(cat => (
                <CategorySection
                    key={cat.key}
                    category={cat.key}
                    label={cat.label}
                    seriesByName={seriesByName}
                    treasury={snapshot.treasury}
                />
            ))}
        </section>
    );
}

function CategorySection({
    category,
    label,
    seriesByName,
    treasury,
}: CategorySectionProps) {
    const metas = ECONOMY_INDICATORS.filter(m => m.category === category);
    const cards = metas
        .map(m => {
            const series = seriesByName.get(m.name);
            if (series === undefined || series.latest === null) return null;
            return <IndicatorCard key={m.name} meta={m} series={series} />;
        })
        .filter((c): c is ReactElement => c !== null);

    const treasuryCards =
        category === 'rates' && treasury !== null
            ? [
                  <TreasuryYieldCard
                      key="year10"
                      snapshot={treasury}
                      maturity="year10"
                  />,
                  <TreasuryYieldCard
                      key="year2"
                      snapshot={treasury}
                      maturity="year2"
                  />,
                  <YieldSpreadCard key="2s10s" snapshot={treasury} />,
              ]
            : [];

    const total = cards.length + treasuryCards.length;
    if (total === 0) return null;

    return (
        <div>
            <h3 className="mb-3 text-base font-medium text-secondary-200">
                {label}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards}
                {treasuryCards}
            </div>
        </div>
    );
}

function IndicatorCard({ meta, series }: IndicatorCardProps) {
    const latest = series.latest;
    if (latest === null) return null;
    const prev = series.previous;
    const delta = prev !== null ? latest.value - prev.value : null;
    return (
        <article className="rounded-xl border border-secondary-700 bg-secondary-800 p-4">
            <header className="mb-2 flex items-center gap-1 text-sm text-secondary-300">
                <span>{meta.label}</span>
                <InfoTooltip>{meta.tooltip}</InfoTooltip>
            </header>
            <div className="text-2xl font-semibold text-secondary-100">
                {latest.value.toFixed(meta.precision)}
                <span className="ml-1 text-sm text-secondary-400">
                    {meta.unit}
                </span>
            </div>
            {delta !== null && (
                <DeltaBadge
                    delta={delta}
                    precision={meta.precision}
                    unit={meta.unit}
                />
            )}
            <p className="mt-1 text-xs text-secondary-400">{latest.date}</p>
        </article>
    );
}

function TreasuryYieldCard({ snapshot, maturity }: TreasuryYieldCardProps) {
    const value = snapshot[maturity];
    if (value === null) return null;
    const { label, tooltip, unit } = TREASURY_CARD_META[maturity];
    return (
        <article className="rounded-xl border border-secondary-700 bg-secondary-800 p-4">
            <header className="mb-2 flex items-center gap-1 text-sm text-secondary-300">
                <span>{label}</span>
                <InfoTooltip>{tooltip}</InfoTooltip>
            </header>
            <div className="text-2xl font-semibold text-secondary-100">
                {value.toFixed(TREASURY_YIELD_PRECISION)}
                <span className="ml-1 text-sm text-secondary-400">{unit}</span>
            </div>
            <p className="mt-1 text-xs text-secondary-400">{snapshot.date}</p>
        </article>
    );
}

function YieldSpreadCard({ snapshot }: YieldSpreadCardProps) {
    const t = useTranslations('widgets.economy');
    const spread = computeYieldSpread(snapshot);
    if (spread === null) return null;
    const positive = spread >= 0;
    return (
        <article className="rounded-xl border border-secondary-700 bg-secondary-800 p-4">
            <header className="mb-2 flex items-center gap-1 text-sm text-secondary-300">
                <span>{t('EconomicIndicatorGrid.2388de')}</span>
                <InfoTooltip>{t('EconomicIndicatorGrid.868089')}</InfoTooltip>
            </header>
            <div
                className={cn(
                    'text-2xl font-semibold',
                    positive ? 'text-ui-success' : 'text-ui-danger'
                )}
            >
                {positive ? '+' : ''}
                {spread.toFixed(TREASURY_YIELD_PRECISION)}
                <span className="ml-1 text-sm text-secondary-400">%p</span>
            </div>
            <p className="mt-1 text-xs text-secondary-400">{snapshot.date}</p>
        </article>
    );
}

function DeltaBadge({ delta, precision, unit }: DeltaBadgeProps) {
    const t = useTranslations('widgets.economy');
    // 부동소수점 잔차나 표시 정밀도 미만 변화(예: delta=0.003, precision=2)도
    // 화면에서는 변화 없음이므로 포맷팅된 값을 기준으로 0 판정한다.
    const formatted = delta.toFixed(precision);
    if (parseFloat(formatted) === 0) {
        return (
            <span className="mt-1 inline-block text-xs text-secondary-400">
                {t('EconomicIndicatorGrid.015416')}
            </span>
        );
    }
    const positive = delta > 0;
    const sign = positive ? '+' : '';
    // Direction chevrons convey movement without implying good/bad valence —
    // green/red would be semantically wrong for indicators like CPI or
    // unemployment where rising values are not positive outcomes.
    return (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-secondary-300">
            <svg
                aria-hidden="true"
                viewBox="0 0 10 10"
                className="h-2.5 w-2.5 fill-none stroke-current"
                strokeWidth={1.5}
            >
                {positive ? (
                    <path d="M2 6.5 5 3.5 8 6.5" />
                ) : (
                    <path d="M2 3.5 5 6.5 8 3.5" />
                )}
            </svg>
            {t('EconomicIndicatorGrid.8d282d')} {sign}
            {formatted}
            {unit}
        </span>
    );
}
