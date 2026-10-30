import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface HomeBacktestingCtaProps {
    /** "AI 분석을 믿을 수 있나" 류의 질문 한 줄. 제목 크기로 보인다. */
    readonly question: string;
    readonly body: string;
    readonly ctaLabel: string;
}

/**
 * 홈의 백테스팅 진입 카드. 백테스팅은 AI 분석이 "믿을 만한가"에 답하는 유일한 실증이라, 질문을
 * 제목 크기로 올리고 액센트 보더로 짚는다. 문구는 페이지가 번역해 넘긴다(`HomeHero`와 같은 이유).
 */
export function HomeBacktestingCta({
    question,
    body,
    ctaLabel,
}: HomeBacktestingCtaProps) {
    return (
        <div
            className={cn(
                SURFACE_CARD,
                'flex flex-col items-center gap-4 border-l-2 border-l-primary-500 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left'
            )}
        >
            <div>
                <p className="text-lg font-semibold text-secondary-100">
                    {question}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                    {body}
                </p>
            </div>
            <Link
                href="/backtesting"
                // 랜딩은 트래픽이 가장 많은 페이지라, prefetch를 켜면 이 링크 하나가 파편화된 `_rsc`
                // 요청을 대량으로 만든다.
                prefetch={false}
                className="shrink-0 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {ctaLabel}
            </Link>
        </div>
    );
}
