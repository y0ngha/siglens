import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

export interface NewsCardShellProps {
    /**
     * 카드 제목 — titleKo가 있으면 titleKo, 없으면 titleEn.
     * 호출 측에서 `item.titleKo ?? item.titleEn`으로 전달한다.
     */
    title: string | null;

    /**
     * 제목이 비었을 때 링크 텍스트로 쓸 출처 이름. 없으면 URL 호스트를 쓴다.
     * 제목이 없어도 카드는 여전히 stretched link여야 한다 — 링크가 사라지면 카드 전체가
     * 눌러도 반응 없는 죽은 영역이 되고, 하단 "원문 보기" 단서만 남아 거짓말이 된다.
     */
    fallbackTitle?: string;

    /** priceImpact === 'high'일 때 amber 왼쪽 border accent를 표시한다. */
    isHighImpact: boolean;

    /** pending=true일 때 제목 텍스트를 opacity-80으로 표시한다. */
    pending: boolean;

    /**
     * pending 상태 중 배지 행 대신 표시할 스켈레톤 노드.
     * 각 서피스가 자체 aria-hidden·텍스트 컬러를 가지므로 props로 주입한다.
     */
    analysisSkeleton: ReactNode;

    /**
     * pending 상태 중 본문 영역 대신 표시할 스켈레톤 노드.
     * 각 서피스가 자체 aria-hidden 속성을 가지므로 props로 주입한다.
     */
    summarySkeletonLine: ReactNode;

    /**
     * ready 상태의 배지 행 (감성·영향도·카테고리·시각·출처 등).
     * 배지 행의 wrapper div 클래스와 내부 요소가 서피스마다 다르므로
     * 호출 측에서 완성된 JSX 노드를 전달한다.
     */
    badgeRow: ReactNode;

    /**
     * 티커 칩 슬롯 (선택).
     * market-news 카드만 사용한다; NewsList 카드는 이 prop을 생략한다.
     */
    tickerChipSlot?: ReactNode;

    /**
     * 본문/요약 섹션 노드.
     * 호출 측에서 bodyKo·summaryKo에 따라 조건부로 구성해 전달한다.
     */
    bodySection: ReactNode;

    /**
     * 카드 하단의 "원문 보기 →" **시각 단서**의 자식 노드.
     *
     * 링크가 아니다. 카드 전체가 제목 링크의 stretched-link로 눌리므로 이 문구는
     * "눌러 볼 수 있다"는 힌트일 뿐이고, 스크린리더에는 제목 링크가 이미 이름을
     * 주므로 `aria-hidden`으로 감춘다(같은 목적지를 가리키는 링크를 두 번 읽지 않게).
     * pending(분석 중) 카드에는 그리지 않는다.
     */
    linkChildren: ReactNode;

    /** 원문 URL — 제목 링크의 목적지. pending일 때도 제목은 링크다. */
    url: string;
}

/** URL의 호스트. 파싱에 실패하면 빈 문자열(링크 텍스트로 쓸 수 없다). */
function hostOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

/** 링크 텍스트: 제목 → 출처 이름 → URL 호스트. 모두 비면 `''`(링크를 그리지 않는다). */
function resolveLinkText(
    title: string | null,
    fallbackTitle: string | undefined,
    url: string
): string {
    if (title !== null && title.trim() !== '') return title;
    if (fallbackTitle !== undefined && fallbackTitle.trim() !== '')
        return fallbackTitle;
    return hostOf(url);
}

/**
 * 뉴스 카드의 공통 article 셸.
 *
 * NewsList의 `NewsCard`와 `MarketNewsCard` 양쪽이 공유하는
 * 외곽 article wrapper · 제목 · pending/ready 분기 구조를 단일 소스로 관리한다.
 * 서피스별로 다른 레이블·클래스 맵·DOM 세부사항은 props/children으로 주입되므로
 * 최종 렌더 DOM은 서피스마다 다를 수 있다.
 *
 * **카드 전체가 하나의 링크다(stretched link).** 예전에는 카드 맨 아래 작은 글씨
 * "원문 보기"만 링크였고, 그마저 분석 중에는 그려지지 않았다 — 카드 본체와 제목을
 * 눌러도 아무 일이 없었다. 지금은 제목 `<a>`의 `::after`가 `relative`인 article을
 * 덮어 어디를 눌러도 원문이 열린다. 안에 다른 상호작용 요소(티커 칩 링크)가 있으면
 * `relative z-10`으로 `::after` 위에 올려야 눌린다. `<a>` 안에 `<a>`를 중첩하지
 * 않는 구조라 HTML이 유효하다.
 */
export function NewsCardShell({
    title,
    fallbackTitle,
    isHighImpact,
    pending,
    analysisSkeleton,
    summarySkeletonLine,
    badgeRow,
    tickerChipSlot,
    bodySection,
    linkChildren,
    url,
}: NewsCardShellProps) {
    const t = useTranslations('shared.ui');
    const linkText = resolveLinkText(title, fallbackTitle, url);
    return (
        <article
            className={cn(
                SURFACE_CARD,
                'hover:border-primary-500/50 relative w-full max-w-full min-w-0 overflow-hidden p-4 transition-[colors,transform] hover:-translate-y-px',
                // content가 3px 바에 붙지 않도록 pl-5로 패딩을 보정한다.
                isHighImpact && 'border-l-ui-warning border-l-[3px] pl-5'
            )}
        >
            <h3
                className={cn(
                    // 색을 카드에서 상속하면 이 h3가 자기를 거느린 섹션 h2보다
                    // 밝아진다(실측 다크 17.28 대 16.99). 기사 제목은 이 페이지의
                    // 본문이지만 구조상으로는 h2 아래다.
                    //
                    // 한때 `font-semibold text-secondary-100`으로 h2와 **같은 단계**를
                    // 줬는데, 그러면 h2와 색·굵기가 완전히 같고 크기만 2px 달라진다
                    // (실측 /news/general: h2 18/600/sec-100, 이 h3 16/600/sec-100).
                    // 지금은 h3 토큰을 써서 한 단계 아래로 명시한다 — 원래 걱정이던
                    // "h3가 h2보다 밝아짐"은 sec-200이 sec-100보다 어두우므로 그대로 해결된다.
                    HEADING_SUBSECTION,
                    'leading-snug text-balance wrap-break-word',
                    pending && 'opacity-80'
                )}
            >
                {linkText !== '' && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {linkText}{' '}
                        <span className="sr-only">
                            {t('NewsCardShell.074b02')}
                        </span>
                    </a>
                )}
            </h3>

            {pending ? analysisSkeleton : badgeRow}

            {tickerChipSlot}

            {pending ? summarySkeletonLine : bodySection}

            {!pending && (
                <span
                    aria-hidden="true"
                    className="mt-2 inline-block text-xs text-primary-400"
                >
                    {linkChildren}
                </span>
            )}
        </article>
    );
}
