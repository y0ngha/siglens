import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface NewsCardShellProps {
    /**
     * 카드 제목 — titleKo가 있으면 titleKo, 없으면 titleEn.
     * 호출 측에서 `item.titleKo ?? item.titleEn`으로 전달한다.
     */
    title: string | null;

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
     * "원문 보기" 링크의 자식 노드.
     * NewsList: `원문 보기 →` (텍스트 노드)
     * MarketNewsCard: `원문 보기 <span aria-hidden>→</span>`
     */
    linkChildren: ReactNode;

    /** 원문 URL — pending일 때는 링크 자체를 렌더하지 않는다. */
    url: string;
}

/**
 * 뉴스 카드의 공통 article 셸.
 *
 * NewsList의 `NewsCard`와 `MarketNewsCard` 양쪽이 공유하는
 * 외곽 article wrapper · 제목 · pending/ready 분기 구조를 단일 소스로 관리한다.
 * 서피스별로 다른 레이블·클래스 맵·DOM 세부사항은 props/children으로 주입되므로
 * 최종 렌더 DOM은 서피스마다 다를 수 있다.
 */
export function NewsCardShell({
    title,
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
    return (
        <article
            className={cn(
                'border-secondary-700 bg-secondary-800 hover:border-primary-500/50 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-4 transition-[colors,transform] hover:-translate-y-px',
                // content가 3px 바에 붙지 않도록 pl-5로 패딩을 보정한다.
                isHighImpact && 'border-l-ui-warning border-l-[3px] pl-5'
            )}
        >
            <h3
                className={cn(
                    'leading-snug font-semibold text-balance wrap-break-word',
                    pending && 'opacity-80'
                )}
            >
                {title}
            </h3>

            {pending ? analysisSkeleton : badgeRow}

            {tickerChipSlot}

            {pending ? summarySkeletonLine : bodySection}

            {!pending && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 focus-visible:ring-primary-500 mt-2 inline-block text-xs transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
                >
                    {linkChildren}
                </a>
            )}
        </article>
    );
}
