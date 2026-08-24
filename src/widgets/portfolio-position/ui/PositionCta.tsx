import Link from 'next/link';
import { formatAmount } from '../lib/positionBuildingNotes';

interface PositionCtaProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
}

/**
 * Shared CTA card shown to both anonymous visitors and members with no holding
 * on this symbol — "내 위치" needs an avg purchase price to draw a building, so
 * there is nothing personalized to render for either audience. Kept as a plain
 * presentational component (no hooks) so the guest gate in `PositionTabContent`
 * can render it directly without pulling in the lazy member chunk.
 */
export function PositionCta({ symbol, low52w, high52w }: PositionCtaProps) {
    return (
        <section
            data-testid="position-cta"
            className="flex flex-col items-start gap-3 rounded-lg border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <p className="text-sm font-semibold text-secondary-100">
                보유종목을 등록하면 내 매수 층이 표시돼요
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                평단과 수량을 등록하면 최근 가격 범위 안에서 내 위치를
                아이소메트릭 빌딩으로 확인할 수 있어요.
            </p>
            {low52w !== null && high52w !== null && (
                <p
                    data-testid="position-cta-range"
                    className="text-xs text-secondary-400 tabular-nums"
                >
                    최근 범위 {formatAmount(low52w, symbol)} ~{' '}
                    {formatAmount(high52w, symbol)}
                </p>
            )}
            <Link
                href="/onboarding"
                className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-primary-500 px-4 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/10 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                보유종목 등록하기
            </Link>
        </section>
    );
}
