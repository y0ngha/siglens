import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { formatAmount } from '../lib/positionBuildingNotes';
import type { PositionModel } from '../lib/positionGeometry';

interface PositionCardProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    avg: number;
}

/** ≥0면 성공, <0면 위험 — AA 텍스트 변형 토큰(DESIGN.md §AA), chart-*는 그래픽 전용이라 미사용. */
function signColorClass(value: number): string {
    return value >= 0 ? 'text-ui-success-text' : 'text-ui-danger-text';
}

interface ReadoutRowProps {
    label: string;
    value: string;
    valueClassName?: string;
}

function ReadoutRow({ label, value, valueClassName }: ReadoutRowProps) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-secondary-400">{label}</dt>
            <dd className={cn('tabular-nums', valueClassName)}>{value}</dd>
        </div>
    );
}

/**
 * "내 위치" 카드 — TechnicalFactsSummary/계정 카드와 동일 chrome(bg-secondary-800
 * rounded-lg)을 사용해 사이드바에서 한 벌처럼 보이게 한다. 수치 리드아웃
 * (최근 고/저·현재가·내 평단·%대비·수익률·범위 위치)만 표시하는 standalone 카드다.
 * 범위는 "52주"가 아니라 현재 선택된 타임프레임의 최근 252개 봉 기준(technicalFacts.ts)
 * 이므로 TechnicalFactsSummary와 동일하게 타임프레임-중립 문구를 쓴다.
 */
export function PositionCard({
    symbol,
    model,
    low52w,
    high52w,
    current,
    avg,
}: PositionCardProps) {
    const t = useTranslations('widgets.portfolio-position');
    const tMisc = useTranslations('shared.ui.misc');
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            <h2
                id={headingId}
                className="text-sm font-semibold text-secondary-200"
            >
                {t('PositionCard.69d338')}
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm text-secondary-300">
                <ReadoutRow
                    label={t('PositionCard.e02b15')}
                    value={formatAmount(high52w, symbol)}
                />
                <ReadoutRow
                    label={t('PositionCard.e21fad')}
                    value={formatAmount(low52w, symbol)}
                />
                <ReadoutRow
                    label={t('PositionCard.497d1e')}
                    value={formatAmount(current, symbol)}
                />
                <ReadoutRow
                    label={t('PositionCard.082179')}
                    value={formatAmount(avg, symbol)}
                />
                <ReadoutRow
                    label={t('PositionCard.5ed98d')}
                    value={formatSignedPercent(model.pctFromHigh)}
                    valueClassName={signColorClass(model.pctFromHigh)}
                />
                <ReadoutRow
                    label={t('PositionCard.f2e157')}
                    value={formatSignedPercent(model.pctAboveLow)}
                    valueClassName={signColorClass(model.pctAboveLow)}
                />
                <ReadoutRow
                    label={t('PositionCard.fb64df')}
                    value={formatSignedPercent(model.returnPct)}
                    valueClassName={signColorClass(model.returnPct)}
                />
                <ReadoutRow
                    label={t('PositionCard.ffe45d')}
                    value={tMisc('rangePoint', {
                        v0: model.rangePositionPct.toFixed(0),
                    })}
                />
            </dl>
        </section>
    );
}
