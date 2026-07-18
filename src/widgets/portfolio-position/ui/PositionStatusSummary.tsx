import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, formatSignedUsd } from '@/shared/lib/priceFormat';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import { buildPositionStatusAriaLabel } from '../lib/positionStatus';
import type { PositionStatus } from '../lib/positionStatus';

interface PositionStatusSummaryProps {
    status: PositionStatus | null;
    /** 회원이 입력한 원본 평단 decimal 문자열(holding.averagePrice) — trimTrailingZeros로만 다듬는다. */
    avgRaw: string;
    /** 회원이 입력한 원본 수량 decimal 문자열(holding.quantity) — trimTrailingZeros로만 다듬는다. */
    quantityRaw: string;
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
 * "내 포지션" 결정적(non-AI) 요약 카드 — "내 평단 기준으로 분석했어요" 배지 옆에
 * 노출해 회원이 AI 서사와 별개로 자신의 실제 포지션 사실(평가손익·수익률·범위 내
 * 위치·고점/저점까지 거리)을 바로 확인하게 한다. scope fence: 매수/매도 판단·
 * 목표가·진입구간 등 core AI 도메인 값은 포함하지 않는다 — 순수 산술 결과만.
 *
 * `status`가 null이면(가격 데이터 미비/degenerate 입력) 아무것도 렌더하지 않는다
 * — 호출부가 이 게이트를 대신 수행하지 않아도 안전하다(computePositionStatus 참조).
 * 평단·수량은 PortfolioChip과 동일하게 원본 decimal 문자열을 trimTrailingZeros로만
 * 다듬어 표시한다 — JS float round-trip을 거치지 않아 crypto sub-cent 평단도
 * 안전하다. 평가손익/수익률만 색상 코딩한다(ui-success/danger) — 범위 내 위치·
 * 고점/저점까지 거리는 손익 판단이 아닌 중립적 사실이라 색상을 입히지 않는다.
 */
export function PositionStatusSummary({
    status,
    avgRaw,
    quantityRaw,
}: PositionStatusSummaryProps) {
    if (status === null) return null;

    const avgDisplay = `$${trimTrailingZeros(avgRaw)}`;
    const quantityDisplay = `${trimTrailingZeros(quantityRaw)}주`;
    const ariaLabel = buildPositionStatusAriaLabel(
        status,
        avgDisplay,
        quantityDisplay
    );

    return (
        <section
            aria-label={ariaLabel}
            data-testid="position-status-summary"
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            {/* 시각 헤딩. 접근명은 위 section의 aria-label(전체 포지션 요약)이
                담당하므로 h2에 id/aria-labelledby 연결을 두지 않는다. */}
            <h2 className="text-secondary-200 text-sm font-semibold">
                내 포지션
            </h2>
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <ReadoutRow
                    label="평단 · 수량"
                    value={`${avgDisplay} · ${quantityDisplay}`}
                />
                <ReadoutRow
                    label="평가손익"
                    value={formatSignedUsd(status.unrealizedPnl)}
                    valueClassName={signColorClass(status.unrealizedPnl)}
                />
                <ReadoutRow
                    label="수익률"
                    value={formatSignedPercent(status.returnPct)}
                    valueClassName={signColorClass(status.returnPct)}
                />
                <ReadoutRow
                    label="현재가의 범위 내 위치"
                    value={`${status.rangePositionPct.toFixed(0)}% 지점`}
                />
                <ReadoutRow
                    label="최근 고점까지"
                    value={formatSignedPercent(status.distanceToHighPct)}
                />
                <ReadoutRow
                    label="최근 저점까지"
                    value={formatSignedPercent(status.distanceToLowPct)}
                />
            </dl>
        </section>
    );
}
