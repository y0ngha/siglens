/**
 * 보강 대기 중인 카드의 배지 행 자리표시자.
 */
import { useTranslations } from 'next-intl';

/**
 * aria-hidden=true — 스크린리더는 로딩 중 애니메이션 마커를 읽지 않는다.
 * text-secondary-400 텍스트 컬러는 종목 뉴스 목록(text-secondary-500)과 의도적으로 다르다.
 */
export function AnalysisSkeleton() {
    const t = useTranslations('widgets.market-news');
    return (
        <div
            aria-hidden="true"
            className="mt-1.5 flex flex-wrap items-center gap-2"
        >
            <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <span className="text-xs text-secondary-400">
                {t('MarketNewsCard.d12df8')}
            </span>
        </div>
    );
}
