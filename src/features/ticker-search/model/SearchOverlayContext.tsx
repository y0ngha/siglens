'use client';

import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
    type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { useSearchOverlay } from '../hooks/useSearchOverlay';
import { NavigationProgressBar } from '../ui/NavigationProgressBar';
import { SearchOverlay } from '../ui/SearchOverlay';

interface SearchOverlayContextValue {
    open: () => void;
}

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(
    null
);

/**
 * 전체화면 검색 오버레이를 **앱 전체에 단 하나만** 호스팅한다.
 *
 * 트리거는 두 곳이다 — 헤더의 돋보기 아이콘(`HeaderSearch`)과 홈 히어로의
 * 검색창(`SymbolSearchPanel`). 각자 오버레이를 마운트하면 홈에서 **두 개가 동시에
 * 존재**하고, `useSearchOverlay`가 두 벌 돌면서 `pushState`/`popstate` 핸들러가
 * 서로를 밟는다(한쪽이 항목을 넣고 다른 쪽이 pop을 받는 식). 뒤로가기가 조용히
 * 깨지는 부류의 버그다.
 *
 * `features/symbol-model/model/SymbolModelContext`가 회원가입 넛지 모달을 단 하나만
 * 호스팅하는 것과 같은 이유·같은 형태다. 이 슬라이스의 context도 그 관행대로 `model/`에 둔다
 * (`features/share/model`, `features/symbol-chat/model`도 동일).
 *
 * ## 왜 `next/dynamic`으로 미루지 않는가
 *
 * 이 provider는 root layout에 있어 오버레이 본체가 **전 라우트 first-load**에 실린다
 * (실측 gzip +5.4KB). 그래도 정적 import를 유지한다 — iOS Safari는 탭 제스처와 같은
 * 태스크에서 잡힌 포커스가 아니면 키보드를 올리지 않는데, 동적 import는 청크가 아직
 * 안 받아졌을 때 입력을 **다음 태스크**에 마운트시킨다. 그러면 키보드가 안 뜨고, 이
 * 기능의 존재 이유가 사라진다. 하필 그 실패가 걸리는 대상은 콜드 로드 직후 검색을
 * 누르는 모바일 사용자다.
 *
 * 대신 비용을 다른 데서 깎았다 — `lib/popularPreview.ts`는 config를 import하지 않고
 * 값을 직접 담는다(그 import 하나가 gzip 2,017B였다).
 */
export function SearchOverlayProvider({ children }: { children: ReactNode }) {
    /**
     * 진행 바를 우리가 직접 소유하는 스위치.
     *
     * `isPending` 하나에만 기대면 바가 영영 사라지지 않을 수 있다 — 이동 중에
     * 뒤로가기가 들어오면 Next는 그 액션을 `discarded`로 표시하고 `handleResult`가
     * `action.resolve`를 **부르지 않은 채** 빠져나간다(`app-router-instance.js`).
     * transition이 물고 있는 promise가 끝내 결착되지 않으므로, 순수 표시용 띠가
     * 남의 promise 수명에 매달리지 않게 우리 상태로 한 번 더 잠근다.
     */
    const [isNavigationPending, setIsNavigationPending] = useState(false);

    const { isOpen, open, close, dismissForNavigation } = useSearchOverlay();
    const router = useRouter();
    const toLocalePath = useLocalePath();
    const pathname = usePathname();
    const [isNavigating, startNavigation] = useTransition();

    /**
     * 종목으로 이동한다. **오버레이는 즉시 닫고** 이동은 뒤에서 진행시킨다.
     *
     * `router.push`가 아니라 `replace`인 이유는 `useSearchOverlay`가 열 때 넣어 둔
     * 히스토리 항목을 목적지로 대체해야 뒤로가기가 `AAPL → NVDA`가 되기 때문이다.
     *
     * 이동을 여기(provider)에서 소유하는 이유는 진행 바 때문이다. 오버레이는 이미
     * 닫혔으므로 대기 표시를 오버레이 안에 둘 수 없다 — 그렇다고 오버레이를 열어두면
     * 예전의 세 가지 버그(갇힘·popstate 우회·취소 경합)가 되살아난다. 표시는 밖에,
     * 닫기는 즉시.
     */
    const navigateToSymbol = useCallback(
        (symbol: string) => {
            const hasOwnHistoryEntry = dismissForNavigation();
            setIsNavigationPending(true);
            // 우리 항목이 있을 때만 `replace`다. 없으면(열 때 `pushState`가 실패한
            // 경우) `replace`가 **사용자가 보던 페이지의 항목**을 덮어써 뒤로가기가
            // 그 페이지를 건너뛴다.
            //
            // 호출 결과를 그대로 돌려준다. 지금 라우터는 void를 반환하지만, React 19의
            // transition은 콜백이 promise를 돌려주면 그게 끝날 때까지 pending을
            // 유지한다 — 반환을 삼키면 그 연결이 끊긴다.
            //
            // 경로에 **로케일 접두사를 붙인다**. `/${symbol}`을 그대로 밀면
            // `/ja`에서 고른 종목이 ko 페이지로 간다 — `useAutocomplete`가 같은
            // 이유로 `toLocalePath`를 쓴다.
            const href = toLocalePath(`/${symbol}`);
            startNavigation(() =>
                hasOwnHistoryEntry ? router.replace(href) : router.push(href)
            );
        },
        [dismissForNavigation, router, toLocalePath]
    );
    // 소비자는 `open`만 필요하다. `isOpen`을 값에 넣으면 오버레이가 열리고 닫힐 때마다
    // 전 소비자가 리렌더된다 — 헤더는 모든 라우트에 있으므로 그 비용이 전역이다.
    const t = useTranslations('features.ticker-search');
    const value = useMemo(() => ({ open }), [open]);

    // 도착했거나(라우트 변경) 사용자가 물러났으면(popstate) 표시를 끝낸다.
    useEffect(() => setIsNavigationPending(false), [pathname]);
    useEffect(() => {
        const stop = () => setIsNavigationPending(false);
        window.addEventListener('popstate', stop);
        return () => window.removeEventListener('popstate', stop);
    }, []);

    return (
        <SearchOverlayContext value={value}>
            {children}
            <SearchOverlay
                isOpen={isOpen}
                onClose={close}
                onNavigate={navigateToSymbol}
            />
            {isNavigating && isNavigationPending && <NavigationProgressBar />}
            {/* 음성 고지는 진행 바 **밖**에 둔다 — `role="progressbar"`는 자손을
                접근성 트리에서 지우므로 그 안의 텍스트는 읽히지 않는다. 리전은 항상
                마운트해 두고 내용만 바꾼다(빈 문자열 ↔ 문구). */}
            <span role="status" className="sr-only">
                {isNavigating && isNavigationPending
                    ? t('search.navigating')
                    : ''}
            </span>
        </SearchOverlayContext>
    );
}

/**
 * 검색 오버레이를 여는 함수. Provider 밖에서 부르면 `null`을 돌려주므로 호출부가
 * 트리거 자체를 렌더하지 않도록 분기할 수 있다 — 테스트나 스토리북처럼 Provider가
 * 없는 환경에서 터지지 않게 하기 위함이다.
 */
export function useSearchOverlayTrigger(): SearchOverlayContextValue | null {
    return use(SearchOverlayContext);
}
