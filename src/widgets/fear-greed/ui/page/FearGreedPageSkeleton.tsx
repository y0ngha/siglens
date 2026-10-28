import { useTranslations } from 'next-intl';

const BLOCK =
    'animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none';

/** seed가 없을 때 서버·첫 클라 렌더와, 브라우저 조회가 끝나기 전의 Suspense fallback. */
export function FearGreedPageSkeleton() {
    const t = useTranslations('widgets.fear-greed');
    return (
        <div
            role="status"
            className="flex flex-col gap-6 p-4 md:p-6"
            aria-busy="true"
            aria-label={t('FearGreedPage.7da634')}
        >
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <div className={`h-4 w-40 ${BLOCK}`} />
                    <div className={`h-48 w-full ${BLOCK}`} />
                    <div className={`h-16 w-full ${BLOCK}`} />
                </section>
                <section className="flex flex-col gap-3">
                    <div className={`h-20 w-full ${BLOCK}`} />
                    <div className={`h-20 w-full ${BLOCK}`} />
                </section>
            </div>
            <section className="flex flex-col gap-2">
                <div className={`h-4 w-32 ${BLOCK}`} />
                <div className={`h-40 w-full ${BLOCK}`} />
            </section>
        </div>
    );
}
