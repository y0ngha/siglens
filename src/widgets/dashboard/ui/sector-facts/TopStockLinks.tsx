/**
 * 섹터 요약의 대표 종목 링크 목록 — "(애플 (AAPL), …)".
 */
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { DisplayedFactStock } from '../../utils/displayedSectorFacts';

const STOCK_SEPARATOR = ', ';

interface TopStockLinksProps {
    stocks: readonly DisplayedFactStock[];
}

/**
 * 종목은 진짜 `<Link href="/{symbol}">` 앵커다 — 서버 렌더되는 허브 페이지가 종목별
 * 페이지로 크롤 가능한 내부 링크를 건네야 한다. 인터랙티브 패널은 활성 섹터의 종목만
 * 링크하므로 이 앵커가 없으면 대부분의 섹터가 `/{symbol}` 링크를 하나도 못 낸다.
 *
 * `isCuratedSymbol` 검사 없이 링크한다 — 스캔 대상(`DashboardScope.sectorStocks`)은 전부
 * 큐레이션(색인) 집합이라 noindex 롱테일로 가는 앵커가 없다. 그 불변식은
 * `marketHubIndexability.test.ts`가 모든 스코프에서 강제한다.
 */
export function TopStockLinks({ stocks }: TopStockLinksProps) {
    const assetLabel = useAssetLabel();
    if (stocks.length === 0) return null;
    return (
        <span className="ml-2 text-secondary-500">
            {/* 괄호는 JSX 표현식이라 주변에 공백이 끼지 않는다 */}
            {'('}
            {stocks.map((stock, index) => (
                <span key={stock.symbol}>
                    {index > 0 && STOCK_SEPARATOR}
                    <Link
                        href={`/${stock.symbol}`}
                        // 섹터 × 상위 종목 링크가 한 화면에 수십 개라 기본 prefetch면
                        // 뷰포트 진입 즉시 종목 RSC(~1.7MB)를 개수만큼 당긴다.
                        prefetch={false}
                        className="rounded underline-offset-2 hover:text-secondary-300 hover:underline focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                    >
                        {symbolLabel(
                            stock.symbol,
                            assetLabel(stock.symbol, stock.koreanName)
                        )}
                    </Link>
                </span>
            ))}
            {')'}
        </span>
    );
}
