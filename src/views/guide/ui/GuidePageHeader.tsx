import { cn } from '@/shared/lib/cn';

/**
 * h1 위의 눈썹 글자. 고정폭 영문 대문자로 쓰는 표식이라 로케일과 무관하게 같은 글자다
 * (번역할 문구가 아니라 섹션 표지).
 */
const GUIDE_EYEBROW = 'CHART GUIDE';

interface GuidePageHeaderProps {
    readonly title: string;
    /** 제목 아래 한 단락. 없으면 머리 아래 여백도 두지 않는다(뒤따르는 안내 상자가 자기 여백을 가진다). */
    readonly intro?: string;
}

/**
 * 가이드 허브·분류 허브·안내 페이지의 머리. 이 페이지들에서 h1은 여기서만 나온다 — 목록 절은 h2,
 * 카드 제목은 h3라, 검색엔진과 스크린리더의 제목 탐색이 이 h1 하나를 페이지 주제로 읽는다.
 * 두 번째 h1이 생기면 주제가 둘로 갈려 읽히므로 페이지 테스트(`GuidePages.test`)가 h1을 제목으로 단언한다.
 */
export function GuidePageHeader({ title, intro }: GuidePageHeaderProps) {
    return (
        <header
            className={cn('max-w-2xl', intro !== undefined && 'pb-8 sm:pb-10')}
        >
            <p className="font-mono text-xs tracking-widest text-primary-400">
                {GUIDE_EYEBROW}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-secondary-50 sm:text-4xl">
                {title}
            </h1>
            {intro === undefined ? null : (
                <p className="mt-4 text-[15px] leading-7 text-secondary-300 sm:text-base">
                    {intro}
                </p>
            )}
        </header>
    );
}
