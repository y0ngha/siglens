'use client';

/**
 * `/portfolio` 그리드의 보유종목 카드 한 장 — 종목 이름, 포지션 빌딩, 숫자 표. 화면에 들어올 때만
 * 봉을 받고(`useHoldingRangeFacts`), 그릴 수 없으면 카드 단위로 대체 본문을 보인다.
 */
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useInViewOnce } from '@/shared/hooks/useInViewOnce';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { computePosition } from '../utils/positionGeometry';
import { useHoldingRangeFacts } from '../hooks/useHoldingRangeFacts';
import { HoldingCardBody } from './holding-card/HoldingCardBody';

type HoldingCardData = Pick<
    PortfolioHoldingView,
    'symbol' | 'companyName' | 'fmpSymbol' | 'averagePrice'
>;

interface PositionHoldingCardProps {
    holding: HoldingCardData;
}

/** 평단 문자열을 수로 — 양의 유한수가 아니면 null(그릴 수 없다). */
function validAverage(raw: string): number | null {
    const avg = Number(raw);
    return Number.isFinite(avg) && avg > 0 ? avg : null;
}

/**
 * 같은 쿼리 키(`useBars`와 공유)를 써 심볼 페이지를 먼저 방문했다면 캐시를 재사용한다. 평단이
 * 잘못됐으면 봉을 받지 않고 곧바로 평단 확인 안내를 보인다 — 받아도 그릴 수 없다. 받기 실패와
 * 범위 계산 불가는 카드 단위로 대체하고 그리드 전체는 깨지지 않는다.
 */
export function PositionHoldingCard({ holding }: PositionHoldingCardProps) {
    const [setNode, isVisible] = useInViewOnce<HTMLDivElement>();
    const avg = validAverage(holding.averagePrice);
    const { facts, isLoading, isError } = useHoldingRangeFacts(
        holding.symbol,
        holding.fmpSymbol ?? undefined,
        isVisible && avg !== null
    );
    const model =
        facts !== null && avg !== null
            ? computePosition({
                  low52w: facts.low52w,
                  high52w: facts.high52w,
                  current: facts.lastClose,
                  avg,
              })
            : null;

    return (
        // 카드 전체가 그 종목의 "내 위치" 탭으로 가는 링크다 — hover/focus-visible은 바깥 Link가,
        // 시각 chrome(ring/bg/padding)과 IntersectionObserver 대상(ref)은 안쪽 div가 맡는다.
        <Link
            href={`/${holding.symbol}/position`}
            // 보유 종목 수만큼 카드가 렌더된다 — 카드마다 목적지 페이지를 미리 받으면 요청이 종목 수만큼 는다.
            prefetch={false}
            className="group block rounded-lg transition-shadow focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <div
                ref={setNode}
                data-testid="portfolio-holding-card"
                className="flex flex-col items-center gap-3 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700 transition-colors group-hover:ring-secondary-600"
            >
                <div className="w-full truncate text-sm font-semibold text-secondary-100">
                    {symbolLabel(holding.symbol, holding.companyName)}
                </div>

                <HoldingCardBody
                    symbol={holding.symbol}
                    avg={avg}
                    isPending={!isVisible || isLoading}
                    isError={isError}
                    facts={facts}
                    model={model}
                />
            </div>
        </Link>
    );
}
