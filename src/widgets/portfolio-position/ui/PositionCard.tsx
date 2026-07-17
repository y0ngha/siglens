import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatUsdPrice } from '@/shared/lib/priceFormat';
import type { PositionModel } from '../lib/positionGeometry';
import { PositionGauge } from './PositionGauge';

interface PositionCardProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    avg: number;
}

function formatUsd(value: number): string {
    return `$${formatUsdPrice(value)}`;
}

function formatSignedPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
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
 * rounded-lg)을 사용해 사이드바에서 한 벌처럼 보이게 한다. PositionGauge를
 * 감싸고 수치 리드아웃(52주 고/저·현재가·내 평단·%대비·수익률·범위 위치)을 표시한다.
 */
export function PositionCard({
    symbol,
    model,
    low52w,
    high52w,
    current,
    avg,
}: PositionCardProps) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <h2
                id={headingId}
                className="text-secondary-200 text-sm font-semibold"
            >
                내 위치
            </h2>
            <PositionGauge
                symbol={symbol}
                model={model}
                low52w={low52w}
                high52w={high52w}
                current={current}
                avg={avg}
            />
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <ReadoutRow label="52주 고점" value={formatUsd(high52w)} />
                <ReadoutRow label="52주 저점" value={formatUsd(low52w)} />
                <ReadoutRow label="현재가" value={formatUsd(current)} />
                <ReadoutRow label="내 평단" value={formatUsd(avg)} />
                <ReadoutRow
                    label="52주 고점 대비"
                    value={formatSignedPercent(model.pctFromHigh)}
                    valueClassName={signColorClass(model.pctFromHigh)}
                />
                <ReadoutRow
                    label="52주 저점 대비"
                    value={formatSignedPercent(model.pctAboveLow)}
                    valueClassName={signColorClass(model.pctAboveLow)}
                />
                <ReadoutRow
                    label="수익률"
                    value={formatSignedPercent(model.returnPct)}
                    valueClassName={signColorClass(model.returnPct)}
                />
                <ReadoutRow
                    label="52주 범위의 위치"
                    value={`${model.rangePositionPct.toFixed(0)}% 지점`}
                />
            </dl>
        </section>
    );
}
