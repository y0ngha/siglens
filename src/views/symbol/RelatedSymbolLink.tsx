'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * 현재 탭을 유지한 채 피어로 넘어가는 탭 세그먼트. **색인되는 비-차트 탭**(뉴스·공포탐욕)만
 * 해당한다 — 나머지(overall·fundamental·…)는 항상 noindex라 그 탭에서 나가는 칩도 차트
 * (`/{peer}`)로 보낸다. 차트 탭의 세그먼트는 `null`이라 역시 `/{peer}`가 된다.
 */
const TAB_KEEPING_SEGMENTS: ReadonlySet<string> = new Set([
    'news',
    'fear-greed',
]);

interface RelatedSymbolLinkProps {
    /** 피어의 canonical 심볼(`NVDA`, `005930.KS`). */
    symbol: string;
    className: string;
    children: ReactNode;
}

/**
 * 관련 종목 칩의 앵커 — `RelatedSymbols`(서버 컴포넌트)가 칩 내용을 `children`으로 넘기는
 * **클라이언트 leaf**다. 서버 렌더 결과(앵커 마크업·텍스트)는 그대로 SSR HTML에 남고, 이
 * 파일이 하는 일은 `href`를 현재 탭에 맞추는 것뿐이다.
 *
 * ## 왜 탭을 유지하는가 (2026-10-05 운영 크롤)
 *
 * 칩이 항상 `/{peer}`(차트)로만 나가면 뉴스·공포탐욕 탭은 **외부 유입 링크가 0**이다 —
 * 두 탭은 색인되는데도 크롤러가 종목 간 이동으로는 닿지 못한다. 뉴스 탭의 칩은 `/{peer}/news`,
 * 공포탐욕 탭의 칩은 `/{peer}/fear-greed`로 보내 같은 탭끼리 격자를 만든다(탭당 외부 유입
 * 약 8개).
 *
 * `useSelectedLayoutSegment()`는 `[symbol]` 레이아웃 바로 아래 세그먼트를 돌려주므로, 칩이
 * 레이아웃(탭 바깥)에 있어도 현재 탭을 안다. SSR에서도 값이 있어 서버 HTML의 `href`가
 * 정확하다.
 *
 * 피어는 같은 프리웜 유니버스 안이라(`internalLinksArePrewarmed` 가드) `/{peer}/news`·
 * `/{peer}/fear-greed`도 스냅샷이 있다. 크립토·KR 피어도 두 탭을 모두 가진다
 * (`marketProfile/*.ts`의 `tabs`).
 */
export function RelatedSymbolLink({
    symbol,
    className,
    children,
}: RelatedSymbolLinkProps) {
    const segment = useSelectedLayoutSegment();
    const tab =
        segment !== null && TAB_KEEPING_SEGMENTS.has(segment)
            ? `/${segment}`
            : '';
    return (
        <Link
            href={`/${symbol}${tab}`}
            // prefetch={false}: 칩이 8개라 기본 prefetch면 뷰포트 진입 시 RSC 페이로드
            // 8벌(심볼당 ~35KB gzip)을 한꺼번에 당긴다. 이 스트립은 탐색 보조라 즉시성이
            // 필요 없다.
            prefetch={false}
            className={className}
        >
            {children}
        </Link>
    );
}
