'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useHrefBase } from '@/shared/i18n/LocaleContext';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { assignLocation } from '@/shared/lib/crossHostNavigate';
import { useStartNavigation } from '@/shared/model/NavigationPendingContext';

/** `useSymbolNavigation`의 반환값. 두 함수 모두 참조가 안정적이다. */
export interface SymbolNavigation {
    /** 종목 페이지(`/{symbol}`, 로케일 경로)로 이동한다. 히스토리 항목을 남긴다(push). */
    goToSymbol: (symbol: string) => void;
    /** 종목 페이지를 미리 데운다. 같은 심볼은 마운트당 한 번만 한다. */
    prefetchSymbol: (symbol: string) => void;
}

/**
 * 데스크톱 자동완성이 종목 페이지로 가는 길. 즉시 선택(방향키+Enter·클릭)과 결착 후
 * 이동(검색 키) 두 경로가 같은 규칙을 쓰도록 한곳에 둔다.
 *
 * 모바일 오버레이는 이 훅을 쓰지 않는다 — 그쪽은 열 때 넣은 히스토리 항목을 `replace`로
 * 대체해야 해서 규칙이 다르다(`SearchOverlayProvider`).
 */
export function useSymbolNavigation(): SymbolNavigation {
    const prefetchedRef = useRef(new Set<string>());

    const router = useRouter();
    // 목적지 골격·진행 바를 RSC 도착 전에 띄운다(`NavigationPendingContext`).
    const startNavigation = useStartNavigation();
    const toLocalePath = useLocalePath();
    const base = useHrefBase();

    const goToSymbol = useCallback(
        (symbol: string) => {
            const href = toLocalePath(`/${symbol}`);
            // `hrefBase`가 있으면(ai.siglens.io) 라우터의 클라이언트 내비게이션이
            // 아니라 실제 크로스오리진 이동을 해야 한다 — `router.push`는 같은
            // 앱 안의 경로로만 갈 수 있다.
            if (base) {
                assignLocation(`${base}${href}`);
                return;
            }
            startNavigation(href);
            // 자동 리다이렉트가 아니라 사용자가 고른 결과로의 이동이다. 첫 페이지를 그리고 나서 튕기는 흐름이 아니다.
            // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
            router.push(href);
        },
        [base, router, startNavigation, toLocalePath]
    );

    const prefetchSymbol = useCallback(
        (symbol: string) => {
            // 크로스오리진 이동(ai.siglens.io)에는 이 앱의 라우터가 데울 경로가
            // 없다 — 같은 호스트의 존재하지 않는 `/en/AAPL`을 prefetch하게 된다.
            if (base) return;
            if (prefetchedRef.current.has(symbol)) return;
            prefetchedRef.current.add(symbol);
            // prefetch도 로케일 경로여야 한다 — 아니면 ko 페이지를 데워 두고
            // 실제 이동 대상(`/en/AAPL`)은 콜드로 남는다.
            router.prefetch(toLocalePath(`/${symbol}`));
        },
        [base, router, toLocalePath]
    );

    return { goToSymbol, prefetchSymbol };
}
