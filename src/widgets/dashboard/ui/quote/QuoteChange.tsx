/**
 * 시세 카드의 등락률 표시 — 레이아웃에 따라 색·화살표·라벨이 다르다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { formatPriceChange } from '@/shared/lib/priceFormat';

const CHANGE_PERCENT_DIGITS = 2;

interface QuoteChangeProps {
    /** 등락률 (%) — 양수=상승, 음수=하락. */
    changePercent: number;
    /** `index`는 방향 색·화살표, `signal`은 중립 색 + "전일비" 라벨. */
    layout: 'index' | 'signal';
}

/**
 * `index`는 지수 카드라 등락 방향 자체가 정보라서 상승/하락 색과 화살표를 쓴다.
 *
 * `signal`(섹터 신호 카드)은 다르다. 이 값은 **전일 대비 등락률**일 뿐 카드가 속한
 * 신호 섹션(상승 신호·하락 신호)의 방향과 무관한데, 상승 신호 섹션 안에서 빨간
 * `▼-2.1%`가 뜨면 같은 카드가 두 방향을 동시에 말하는 것처럼 읽힌다. 그래서 중립 색 +
 * 화살표 없음 + "전일비" 라벨로 값의 정체를 밝히고, 방향은 부호와 스크린리더용
 * 단어로만 전한다.
 */
export function QuoteChange({ changePercent, layout }: QuoteChangeProps) {
    const t = useTranslations('widgets.dashboard');
    const tMove = useTranslations('shared.lib.priceMove');
    const { sign, colorClass, arrow, arrowLabelKey } =
        formatPriceChange(changePercent);
    const percentText = `${sign}${changePercent.toFixed(CHANGE_PERCENT_DIGITS)}%`;

    if (layout === 'signal') {
        return (
            <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-secondary-300 tabular-nums">
                <span className="text-secondary-400">
                    {t('QuoteHeader.92387b')}
                </span>
                <span className="sr-only">{tMove(arrowLabelKey)}</span>
                <span>{percentText}</span>
            </span>
        );
    }
    return (
        <span
            className={cn(
                'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                colorClass
            )}
        >
            <span aria-hidden="true">{arrow}</span>
            <span className="sr-only">{tMove(arrowLabelKey)}</span>
            {percentText}
        </span>
    );
}
