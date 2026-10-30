/**
 * 마켓 뉴스 카드의 티커 칩 줄.
 */
import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { TickerChipModel } from '../../utils/tickerChips';

const LINK_CHIP_CLASS =
    // `relative z-10`: 제목 링크의 `::after`(stretched link)가 카드 전체를 덮으므로 칩이 그 위로 올라와야 눌린다.
    'relative z-10 inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const TEXT_CHIP_CLASS =
    'rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium text-secondary-300';

interface TickerChipsProps {
    chips: readonly TickerChipModel[];
}

/**
 * 칩 모델을 한 줄로 그린다. 링크 가능한 칩은 `<a>`, 나머지는 표시 전용 `<span>`이다.
 * 칩이 없을 때 컨테이너를 그릴지는 호출부가 정한다.
 */
export function TickerChips({ chips }: TickerChipsProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <div
            data-testid="ticker-chips"
            className="mt-1.5 flex flex-wrap gap-1.5"
        >
            {chips.map(({ ticker, href }, index) =>
                href === null ? (
                    <span
                        // 티커 문자열 외에 안정 id가 없고 같은 티커가 중복될 수 있어 인덱스를 함께 쓴다(정적 목록).
                        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                        key={`${index}-${ticker}`}
                        data-testid="ticker-chip"
                        className={TEXT_CHIP_CLASS}
                    >
                        {ticker}
                    </span>
                ) : (
                    <Link
                        // 위 span과 같은 이유 — 안정 id가 없는 정적 목록.
                        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                        key={`${index}-${ticker}`}
                        href={href}
                        aria-label={t('MarketNewsCard.goToSymbol', {
                            v0: ticker,
                        })}
                        // 뉴스 카드마다 칩이 붙어 다수 렌더 — 프리패치로 요청이 불어나지 않게 끈다.
                        prefetch={false}
                        data-testid="ticker-chip"
                        className={LINK_CHIP_CLASS}
                    >
                        {ticker}
                    </Link>
                )
            )}
        </div>
    );
}
