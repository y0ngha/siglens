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
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

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
    const seriesByName = new Map(
        snapshot.indicators.map(s => [s.name, s] as const)
    );

    return (
        <section
            aria-labelledby="economy-indicators-heading"
            className="space-y-8"
        >
            <h2
                id="economy-indicators-heading"
                className="text-secondary-100 text-xl font-semibold"
            >
                경제지표
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
        .filter(c => c !== null);

    // 금리 섹션은 treasury → 2s10s 스프레드 카드를 추가로 노출.
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
            <h3 className="text-secondary-200 mb-3 text-base font-medium">
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
        <article className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <header className="text-secondary-300 mb-2 flex items-center gap-1 text-sm">
                <span>{meta.label}</span>
                <InfoTooltip>{meta.tooltip}</InfoTooltip>
            </header>
            <div className="text-secondary-100 text-2xl font-semibold">
                {latest.value.toFixed(meta.precision)}
                <span className="text-secondary-400 ml-1 text-sm">
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
            <p className="text-secondary-500 mt-1 text-xs">{latest.date}</p>
        </article>
    );
}

function TreasuryYieldCard({ snapshot, maturity }: TreasuryYieldCardProps) {
    const value = snapshot[maturity];
    if (value === null) return null;
    const label = maturity === 'year2' ? '2년물 국채' : '10년물 국채';
    const tooltip =
        maturity === 'year2'
            ? '미국 정부가 발행하는 2년 만기 국채의 수익률이에요. 단기 시장금리의 기준이에요.'
            : '미국 정부가 발행하는 10년 만기 국채의 수익률이에요. 장기 시장금리와 모기지 금리의 기준이에요.';
    return (
        <article className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <header className="text-secondary-300 mb-2 flex items-center gap-1 text-sm">
                <span>{label}</span>
                <InfoTooltip>{tooltip}</InfoTooltip>
            </header>
            <div className="text-secondary-100 text-2xl font-semibold">
                {value.toFixed(2)}
                <span className="text-secondary-400 ml-1 text-sm">%</span>
            </div>
            <p className="text-secondary-500 mt-1 text-xs">{snapshot.date}</p>
        </article>
    );
}

function YieldSpreadCard({ snapshot }: YieldSpreadCardProps) {
    const spread = computeYieldSpread(snapshot);
    if (spread === null) return null;
    const positive = spread >= 0;
    return (
        <article className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <header className="text-secondary-300 mb-2 flex items-center gap-1 text-sm">
                <span>2s10s 스프레드</span>
                <InfoTooltip>
                    10년물 수익률에서 2년물을 뺀 값이에요. 마이너스가 되면
                    장단기 금리가 뒤집힌 것으로, 흔히 경기침체 신호로 봐요.
                </InfoTooltip>
            </header>
            <div
                className={`text-2xl font-semibold ${positive ? 'text-success-300' : 'text-danger-300'}`}
            >
                {positive ? '+' : ''}
                {spread.toFixed(2)}
                <span className="text-secondary-400 ml-1 text-sm">%p</span>
            </div>
            <p className="text-secondary-500 mt-1 text-xs">{snapshot.date}</p>
        </article>
    );
}

function DeltaBadge({ delta, precision, unit }: DeltaBadgeProps) {
    if (delta === 0) {
        return (
            <span className="text-secondary-400 mt-1 inline-block text-xs">
                전기 대비 변화 없음
            </span>
        );
    }
    const positive = delta > 0;
    const sign = positive ? '+' : '';
    return (
        <span
            className={`mt-1 inline-block text-xs ${positive ? 'text-success-300' : 'text-danger-300'}`}
        >
            전기 대비 {sign}
            {delta.toFixed(precision)}
            {unit}
        </span>
    );
}
