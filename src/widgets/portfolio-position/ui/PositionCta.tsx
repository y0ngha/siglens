import Link from 'next/link';
import { formatUsdPrice } from '@/shared/lib/priceFormat';

interface PositionCtaProps {
    low52w: number | null;
    high52w: number | null;
}

function formatUsd(value: number): string {
    return `$${formatUsdPrice(value)}`;
}

/**
 * Shared CTA card shown to both anonymous visitors and members with no holding
 * on this symbol — "내 위치" needs an avg purchase price to draw a building, so
 * there is nothing personalized to render for either audience. Kept as a plain
 * presentational component (no hooks) so the guest gate in `PositionTabContent`
 * can render it directly without pulling in the lazy member chunk.
 */
export function PositionCta({ low52w, high52w }: PositionCtaProps) {
    return (
        <section
            data-testid="position-cta"
            className="border-secondary-700 bg-secondary-800/40 flex flex-col items-start gap-3 rounded-xl border p-6"
        >
            <p className="text-secondary-100 text-sm font-semibold">
                보유종목을 등록하면 내 매수 층이 표시돼요
            </p>
            <p className="text-secondary-400 text-sm leading-relaxed">
                평단과 수량을 등록하면 최근 가격 범위 안에서 내 위치를
                아이소메트릭 빌딩으로 확인할 수 있어요.
            </p>
            {low52w !== null && high52w !== null && (
                <p
                    data-testid="position-cta-range"
                    className="text-secondary-400 text-xs tabular-nums"
                >
                    최근 범위 {formatUsd(low52w)} ~ {formatUsd(high52w)}
                </p>
            )}
            <Link
                href="/onboarding"
                className="border-primary-500 text-primary-300 hover:bg-primary-500/10 focus-visible:ring-primary-500 inline-flex min-h-11 touch-manipulation items-center rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                보유종목 등록하기
            </Link>
        </section>
    );
}
