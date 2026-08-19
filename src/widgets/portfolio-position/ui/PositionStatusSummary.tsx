import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { currencyForSymbol } from '@/shared/config/marketProfile';
import { cn } from '@/shared/lib/cn';
import {
    formatSignedAmount,
    formatSignedPercent,
} from '@/shared/lib/priceFormat';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import type { PositionStatus } from '../lib/positionStatus';

interface PositionStatusSummaryProps {
    /** 통화 판정(currencyForSymbol)에만 쓰인다 — 시세 조회는 하지 않는다. */
    symbol: string;
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
 *
 * 통화 기호는 `$`로 하드코딩하지 않는다 — `currencyForSymbol`(PortfolioChip과
 * 동일 소스)로 심볼에서 유도해, 한국 상장 종목(`005930.KS`)에 원화 금액을
 * 달러 기호로 표시하지 않는다(SEO/표기 감사, 이 카드가 헤더 PortfolioChip
 * 바로 아래 렌더돼 같은 값을 다른 통화로 보여주면 신뢰를 깬다).
 */
export function PositionStatusSummary({
    symbol,
    status,
    avgRaw,
    quantityRaw,
}: PositionStatusSummaryProps) {
    const t = useTranslations('widgets.portfolio-position');
    // useId는 early return보다 먼저 — 조건부 훅 호출 금지(rules-of-hooks).
    const headingId = useId();

    if (status === null) return null;

    const currencyPrefix = currencyForSymbol(symbol) === 'KRW' ? '₩' : '$';
    const avgDisplay = `${currencyPrefix}${trimTrailingZeros(avgRaw)}`;
    const quantityDisplay = `${trimTrailingZeros(quantityRaw)}주`;

    return (
        <section
            aria-labelledby={headingId}
            data-testid="position-status-summary"
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            <h2
                id={headingId}
                className="text-sm font-semibold text-secondary-200"
            >
                {t('PositionStatusSummary.bda91f')}
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm text-secondary-300">
                <ReadoutRow
                    label={t('PositionStatusSummary.f2116e')}
                    value={`${avgDisplay} · ${quantityDisplay}`}
                />
                <ReadoutRow
                    label={t('PositionStatusSummary.44acd6')}
                    value={formatSignedAmount(status.unrealizedPnl, symbol)}
                    valueClassName={signColorClass(status.unrealizedPnl)}
                />
                <ReadoutRow
                    label={t('PositionStatusSummary.fb64df')}
                    value={formatSignedPercent(status.returnPct)}
                    valueClassName={signColorClass(status.returnPct)}
                />
                <ReadoutRow
                    label={t('PositionStatusSummary.573838')}
                    value={`${status.rangePositionPct.toFixed(0)}% 지점`}
                />
                <ReadoutRow
                    label={t('PositionStatusSummary.160873')}
                    value={formatSignedPercent(status.distanceToHighPct)}
                />
                <ReadoutRow
                    label={t('PositionStatusSummary.70227d')}
                    value={formatSignedPercent(status.distanceToLowPct)}
                />
            </dl>
        </section>
    );
}
