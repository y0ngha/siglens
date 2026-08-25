'use client';

import {
    type KeyboardEvent,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { isKoreanInput } from '@/entities/ticker';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useTickerSearch } from '../hooks/useTickerSearch';
import { POPULAR_PREVIEW_GROUPS } from '../lib/popularPreview';
import { resolveSubmitTarget } from '../lib/resolveSubmitTarget';
import { SEARCH_PLACEHOLDER, SEARCH_ROW_CLASS } from '../lib/searchLabels';
import { SearchResultRow } from './SearchResultRow';

interface SearchOverlayProps {
    isOpen: boolean;
    /** 사용자가 명시적으로 닫을 때. 히스토리 항목을 되돌린다. */
    onClose: () => void;
    /** 종목으로 이동한다. 오버레이를 닫고 이동을 시작하는 책임은 provider에 있다. */
    onNavigate: (symbol: string) => void;
}

/**
 * 모바일 전체화면 검색 오버레이.
 *
 * ## 포털이 필수인 이유
 *
 * `Header`는 `sticky z-50 backdrop-blur-md`다. CSS 명세상 `backdrop-filter`는
 * (`transform`·`filter`와 마찬가지로) **`position: fixed` 자손의 containing block**이
 * 된다. 헤더 안에서 렌더하면 `fixed inset-0`가 뷰포트가 아니라 **56px 헤더 박스**
 * 기준으로 잡혀 오버레이가 헤더 영역만 덮는다. 이 레포는 이미 겪었고
 * `widgets/layout/HeaderMobileMenu`에 같은 주석이 있다.
 *
 * 본체(`SearchOverlayBody`)는 열려 있을 때만 마운트된다 — 훅 비용과 하이드레이션
 * 안전성을 한 번에 해결한다(아래 게이트 주석 참고).
 *
 * ## z-70인 이유
 *
 * `/[symbol]`에는 `FloatingChatButton`이 `z-60`으로 상주한다. `z-50`이면 채팅 FAB이
 * 오버레이 **위에** 뜬다. 헤더(50)·vaul 시트(50)·넛지 모달(50)·PopoverSurface(60)까지
 * 모두 넘으려면 70이 필요하다.
 *
 * ## 포커스: `autoFocus`이지 `useFocusTrap`의 자동 포커스가 아니다
 *
 * `useFocusTrap`은 활성화 시 컨테이너의 **첫 포커서블**로 포커스를 옮기는데, 그건
 * `useEffect`(passive)라 탭 태스크보다 늦다. iOS Safari는 사용자 제스처와 동기적으로
 * 이어지지 않은 `focus()`로는 키보드를 올리지 않는다 — 이 설계의 존재 이유가 무너진다.
 *
 * 그래서 입력이 **DOM 순서상 첫 포커서블**이고(닫기 버튼은 입력 뒤에 둔다 — iOS의
 * "취소는 오른쪽" 관행과도 맞는다), 포커스는 React가 commit 단계에서 동기 호출하는
 * `autoFocus`로 준다. `useFocusTrap`은 **가두는 용도로만** 쓴다.
 */
export function SearchOverlay({
    isOpen,
    onClose,
    onNavigate,
}: SearchOverlayProps) {
    // 닫혀 있으면 **훅조차 돌리지 않는다**. 이 컴포넌트는 root layout의 provider가
    // 호스팅해 33개 전 라우트에 마운트돼 있다. 본체의 훅이 여기 있으면 라우트가
    // 바뀔 때마다 `useRecentSearches`의 동기 `localStorage` 읽기 + `JSON.parse`와
    // React Query observer 하나가 클라이언트 내비게이션의 임계 경로에 딸려온다 —
    // 아무도 검색을 열지 않았는데도.
    //
    // 분리는 하이드레이션 게이트도 겸한다. 서버 HTML에는 포털이 없고 `isOpen`은
    // 클릭으로만 true가 되므로 첫 클라이언트 렌더에도 포털이 없다(React #418).
    // 예전의 `mounted` 상태는 이 사실을 몰라서 두었던 것이라 함께 걷어냈다.
    if (!isOpen) return null;
    return <SearchOverlayBody onClose={onClose} onNavigate={onNavigate} />;
}

function SearchOverlayBody({
    onClose,
    onNavigate,
}: Omit<SearchOverlayProps, 'isOpen'>) {
    const [query, setQuery] = useState('');
    /**
     * 사용자가 검색 키를 눌렀다는 사실. 즉시 이동하지 않고 남겨 둔다.
     *
     * 디바운스가 300ms이므로 마지막 글자를 치고 바로 검색 키를 누르면 결과가 아직
     * 이전 질의의 것이다. 그 상태에서 결정하면 둘 중 하나가 된다 — 엉뚱한 종목으로
     * 가거나(`apple` → `/APPLE` 404), 아무 일도 안 일어나 **검색 키가 먹통으로**
     * 보이거나. 의도를 보류했다가 결착된 뒤 처리하면 둘 다 피한다. 기다리는 동안
     * 화면에는 "검색 중…"이 떠 있다.
     */
    const [isSubmitRequested, setIsSubmitRequested] = useState(false);

    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const pathname = usePathname();
    const { recentSearches, addSearch, clearAll } = useRecentSearches();
    const { results, isSearching, hasQuery, debouncedQuery, isError } =
        useTickerSearch(query);

    // 본체는 열려 있을 때만 마운트된다 — 항상 활성.
    useEscapeKey(onClose, true);
    useFocusTrap(dialogRef, true);

    // 지난 질의가 남지 않는 것은 언마운트가 공짜로 해 준다(예전에는 `[isOpen]` 효과로
    // 비웠다).

    /**
     * 결착된 조회 결과로 목적지를 정해 이동한다.
     *
     * `useEffectEvent`라 `query`·`results`·`handleSelect`를 **항상 최신으로** 읽으면서도
     * 아래 효과의 의존성에는 들어가지 않는다. 렌더 중에 ref를 갈아 끼우던 예전 방식은
     * React Compiler가 최적화를 포기하게 만들고 동시성 렌더에서 안전하지 않다.
     */
    const submitResolvedTarget = useEffectEvent(() => {
        const target = resolveSubmitTarget(query, results);
        if (target) handleSelect(target.symbol, target.label);
    });

    const isSettled = debouncedQuery.trim() === query.trim();

    /**
     * 결과·최근·인기 모든 행이 거치는 단일 경로.
     *
     * 이 함수는 라우터를 직접 만지지 않는다 — 무엇을 골랐는지만 `onNavigate`로 넘기고,
     * 실제 이동(`router.replace`)과 진행 바는 `SearchOverlayProvider`가 소유한다.
     * 경계를 이렇게 갈라야 오버레이가 닫힌 뒤에도 대기 표시를 이어갈 수 있다.
     *
     * ## 이동 중 상태를 두지 않는 이유
     *
     * 한때 `useTransition`으로 "이동 중…"을 띄우고 그동안 닫기를 막았다. 그 설계가
     * 문제를 셋 만들었다:
     *
     * 1. 이동이 멈추면 취소가 영구 비활성이 되어 **전체화면 모달에 갇힌다**(WCAG 2.1.2).
     * 2. 안드로이드 하드웨어 뒤로가기·iOS 엣지 스와이프는 `onClose`를 거치지 않고
     *    `popstate`를 직접 쏘므로 그 가드가 아예 적용되지 않았다.
     * 3. 대기 중 `history.back()`이 일어나면 늦게 도착한 RSC 응답이 사용자가 물러난
     *    항목을 덮어쓴다 — **고 판단했으나 사실이 아니다.** 설치된 next@16.2.12의
     *    `node_modules/next/dist/client/components/app-router-instance.js`에서 확인했다:
     *    `ACTION_NAVIGATE`/`ACTION_RESTORE`가 들어오면 진행 중인 액션에
     *    `actionQueue.pending.discarded = true`를 세우고(L145-146), `handleResult`는
     *    `action.discarded`면 `actionQueue.state = nextState`도 `action.resolve`도
     *    하지 않고 빠져나간다(L76-93). `setState`에 도달하지 않으니 `HistoryUpdater`도
     *    돌지 않는다 — 되돌아간 자리가 유지된다.
     *
     *    이 사실은 1·2와 **독립적이다**. 1·2만으로도 가드 제거 근거는 충분하므로,
     *    Next의 이 동작이 훗날 바뀌더라도 가드를 되살릴 이유는 되지 못한다(대신
     *    `SearchOverlayProvider`가 진행 바를 자기 상태로 잠가, 폐기된 이동이
     *    `action.resolve`를 영영 부르지 않아도 띠가 남지 않게 해 둔다).
     *
     * 1·2만으로 제거 근거는 충분하다. 3은 이 버전에서 성립하지 않는다는 사실을 남겨
     * 둔다 — 이 경합을 이유로 가드를 되살리자는 제안이 나오면 여기를 보라.
     *
     * 그래서 **닫기는 즉시 하되 대기 표시는 오버레이 밖으로** 뺐다. 이동과 진행 바는
     * `SearchOverlayProvider`가 소유한다.
     *
     * 한때 여기 주석은 "나머지는 Next의 라우트 전환이 처리한다"고 적혀 있었는데
     * **사실이 아니었다**. `app/[symbol]/loading.tsx`는 `[symbol]`의 자식 슬롯을 감싸는데
     * 종목→종목 이동은 그 세그먼트 자체를 바꾸므로 서스펜스가 경계 위에서 일어나고,
     * 루트 `loading.tsx`도 `<Suspense>`도 없어 React가 옛 화면을 그대로 붙들고 있는다.
     * 사용자는 애플을 눌렀는데 NVDA 차트를 2~3초 본다(LAX 경로 실측 기준). 셋 다 사라진다.
     */
    function handleSelect(symbol: string, label: string) {
        addSearch({ symbol, label: label.trim() || symbol });
        // 보고 있던 종목을 다시 고른 경우. 이동할 곳이 없으니 닫기만 한다 —
        // `/NVDA`에서 인기 종목의 NVDA를 누르는 건 탭 한 번이면 닿는 흔한 동작이다.
        if (pathname === `/${symbol}`) {
            onClose();
            return;
        }
        onNavigate(symbol);
    }

    /**
     * Enter/이동 키. `enterKeyHint="search"`로 키보드에 검색 키를 띄워 놓고 아무 일도
     * 하지 않으면 약속을 어기는 셈이다.
     *
     * 이 경로는 **원래 있던 기능**이다 — 모바일 인라인 자동완성에는 Enter로 티커에
     * 직행하는 길과 `검색` 버튼이 있었다(`useAutocomplete.handleKeyDown`). 오버레이로
     * 옮기면서 빠뜨리면 "티커를 아는 사용자"가 300ms 디바운스 + 왕복 + 탭을 치르게 되고,
     * 무엇보다 **검색 결과가 없을 때 막다른 길**이 된다 — FMP 검색이 색인하지 않는
     * 종목에 도달할 유일한 방법이 그 직행이었다.
     *
     * 한글 입력은 직행시키지 않는다. `삼성전자`를 그대로 URL로 삼으면 존재하지 않는
     * 종목 페이지로 보내게 된다 — 후보가 없으면 아무것도 하지 않는 편이 낫다.
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        // 한글 IME는 음절을 **확정**할 때도 Enter를 쓴다. 이걸 걸러내지 않으면
        // `삼성전`까지 친 상태에서 확정 Enter가 `삼성` 결과로 이동시킨다.
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();

        // 디바운스(300ms) 때문에 `results`는 한 박자 전 질의의 것일 수 있다.
        // `TS` 입력 후 멈췄다가 `LA`를 이어 치고 곧바로 검색하면 `TS`의 첫 결과로
        // 가버린다. 질의가 아직 반영되지 않았으면 첫 결과를 믿지 않는다.
        // 양쪽 다 trim한다. `debouncedQuery`는 입력 원본이라 `"apple "`처럼 공백이
        // 붙으면 `query.trim()`과 영영 같아지지 않고, 첫 결과가 화면에 있는데도
        // 무시된 뒤 `/APPLE`로 직행해 404가 난다.
        // 지금 결정하지 않고 **의도만 남긴다**. 조회가 결착된 뒤 아래 효과가
        // 어디로 갈지 정한다 — 이유는 그 효과의 주석 참고.
        setIsSubmitRequested(true);
    };

    // 배경 스크롤 잠금. 저장/복원 방식은 HeaderMobileMenu와 동일하다 — 둘이 동시에
    // 열리면 저장값이 서로를 오염시키지만, 오버레이가 열린 동안 햄버거는 가려져
    // 도달할 수 없다.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    /**
     * 보류해 둔 검색 의도를 조회가 결착된 뒤에 처리한다.
     *
     * 실패(`isError`)면 아무 데도 가지 않는다 — 실패한 조회의 빈 결과는 "없다"가
     * 아니고, 사용자에게는 실패 화면을 보여주는 편이 존재하지 않는 종목 페이지로
     * 보내는 것보다 정직하다.
     */
    useEffect(() => {
        if (!isSubmitRequested || !isSettled || isSearching) return;
        setIsSubmitRequested(false);
        if (isError) return;
        submitResolvedTarget();
    }, [isSubmitRequested, isSettled, isSearching, isError]);

    const portalTarget = typeof document === 'undefined' ? null : document.body;
    if (!portalTarget) return null;

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="종목 검색"
            // 포커스 불가한 여백을 탭했을 때 포커스가 body로 떨어지지 않게 한다 —
            // 그러면 focus trap의 edge-wrap이 동작하지 않아 다음 Tab이 오버레이 뒤의
            // 헤더 컨트롤로 새어 나간다(보이지 않는 포커스, WCAG 2.4.11).
            tabIndex={-1}
            // h-dvh는 iOS의 URL 바 노출/숨김에 따라 높이를 맞추기 위한 것이다.
            // **키보드는 dvh에 반영되지 않는다** — 키보드에 가려지는 문제는 아래
            // 스크롤 컨테이너의 하단 여백이 해결한다. 이 둘을 헷갈려 여백을
            // "불필요한 매직 넘버"로 지우지 말 것.
            className="fixed inset-0 z-70 flex h-dvh flex-col bg-secondary-900"
        >
            {/* `viewportFit: cover` + standalone PWA에서 `fixed inset-0`는 화면 물리
                최상단에서 시작한다. 상단 인셋을 주지 않으면 입력과 취소 버튼이
                상태바 아래에 깔린다(WCAG 2.4.11). */}
            <div className="flex items-center gap-2 border-b border-secondary-800 px-3 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
                {/* 입력이 DOM 순서상 첫 포커서블이어야 한다 — 위 JSDoc 참고. */}
                <input
                    ref={inputRef}
                    // iOS 키보드를 띄우려면 탭 태스크와 같은 commit에서 포커스가 잡혀야
                    // 한다. effect 기반 포커스는 늦다 — 위 JSDoc의 "포커스" 절 참고.
                    autoFocus
                    type="search"
                    value={query}
                    onChange={e => {
                        // 계속 타이핑하면 앞서 남긴 검색 의도는 무효다 — 그대로
                        // 두면 새 질의가 결착되는 순간 사용자가 요청하지 않은
                        // 이동이 일어난다(`useAutocomplete`도 같은 규칙).
                        setIsSubmitRequested(false);
                        setQuery(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={SEARCH_PLACEHOLDER}
                    // 보이는 문구(placeholder)와 접근 이름을 같게 둔다 —
                    // 음성 입력 사용자가 화면에 보이는 말로 이 필드를 부를 수 있어야 한다
                    // (WCAG 2.5.3). 히어로 트리거에서 같은 이유로 aria-label을 걷어냈다.
                    aria-label={SEARCH_PLACEHOLDER}
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-border-control bg-secondary-800 px-3 text-base text-secondary-100 placeholder-secondary-400 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-500"
                />
                <button
                    type="button"
                    onClick={onClose}
                    className="min-h-11 shrink-0 touch-manipulation rounded-lg px-3 text-sm text-secondary-300 transition-colors hover:bg-secondary-800 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    취소
                </button>
            </div>

            {/* overscroll-contain — 목록 끝에서 스크롤이 배경으로 넘어가지 않게 한다. */}
            {/*
                `pb-[100dvh]`가 핵심이다. 이게 없으면 콘텐츠 높이가 컨테이너를 넘지 않아
                (`scrollHeight === clientHeight`) **스크롤 자체가 불가능**하다. 뷰포트는
                키보드가 올라와도 `dvh` 그대로라(레이아웃 뷰포트 기준) 컨테이너는 844px인데
                실제로 보이는 건 ~354px뿐이다. 그 결과 인기 종목의 암호화폐 그룹은 영영
                도달할 수 없고, 검색 결과도 6~10번째를 못 본다(390×844 실측).

                아래 여백을 둬 항상 넘치게 만들면 드래그 스크롤이 살아나고, iOS에서
                아래로 끌어 키보드를 내리는 제스처도 함께 동작한다.

                여백이 **키보드 높이 이상**이어야 마지막 행이 키보드 위로 올라온다.
                50dvh(844px 화면에서 422px)는 세로에서도 아슬아슬하고 가로에서는
                확실히 모자란다(뷰포트 ~390px에 키보드 ~200px). 빈 공간이라 바이트도
                페인트 비용도 0이므로 100dvh로 둬 조건을 무조건 만족시킨다.
            */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[100dvh]">
                {/*
                    이 리전은 오버레이가 열릴 때 내용(`검색어를 입력하세요`)과 함께
                    삽입된다. 그 첫 문구는 놓칠 수 있지만 이후의 모든 변화(검색 중 →
                    결과 N건 / 실패)는 리전이 이미 등록된 뒤라 정상적으로 읽힌다.

                    `isSearching`을 먼저 보는 것도 중요하다 — `useTickerSearch`는 새 질의에
                    `placeholderData`가 없어 응답 전 `results`가 빈 배열이다. 그대로 읽으면
                    "검색 결과 0건"을 먼저 말하고 165ms 뒤(LAX RTT) "4건"으로 번복한다.
                */}
                <p className="sr-only" aria-live="polite">
                    {isSearching
                        ? '검색 중'
                        : isError
                          ? '검색을 불러오지 못했습니다'
                          : !hasQuery
                            ? '검색어를 입력하세요'
                            : results.length > 0
                              ? `검색 결과 ${results.length}건`
                              : // 한글 막다른 길의 유일한 출구를 화면에만 두면
                                // 스크린리더 사용자는 그 출구를 못 듣는다(WCAG 4.1.3).
                                isKoreanInput(query)
                                ? '검색 결과 없음 — 티커로 검색해 보세요'
                                : '검색 결과가 없습니다'}
                </p>

                {hasQuery ? (
                    // `role="listbox"`/`role="option"`을 쓰지 않는다. ARIA listbox는 단일
                    // 탭스톱 + 방향키 + `aria-activedescendant`를 갖춘 복합 위젯인데, 이
                    // 오버레이에는 방향키 모델이 없고 각 행이 네이티브 `<button>`이라 저마다
                    // 탭스톱을 갖는다 — 역할만 빌려오면 스크린리더가 폼 모드로 전환한 뒤
                    // 방향키가 먹지 않아 오히려 나빠진다(WCAG 4.1.2). 지금 구조 그대로가
                    // 버튼 목록이고 Tab으로 완전히 조작된다.
                    <section aria-label="검색 결과">
                        {results.map(result => (
                            <SearchResultRow
                                key={result.symbol}
                                result={result}
                                onSelect={handleSelect}
                            />
                        ))}
                        {isSearching && (
                            <p className="px-4 py-3 text-sm text-secondary-400">
                                검색 중…
                            </p>
                        )}
                        {isError && !isSearching && (
                            <p className="px-4 py-10 text-center text-sm text-secondary-400">
                                {/*
                                    "결과 없음"과 "조회 실패"는 다르다. 예전에는 둘을
                                    구분하지 않아 검색 서버가 죽어도 "결과가 없습니다"로
                                    보였고, 한글 질의에는 "티커로 쳐보세요"라는 틀린 안내가
                                    나갔다 — 사용자는 없는 종목을 찾은 줄 안다.
                                */}
                                검색을 불러오지 못했어요. 잠시 후 다시 시도해
                                주세요.
                            </p>
                        )}
                        {results.length === 0 && !isSearching && !isError && (
                            <p className="px-4 py-10 text-center text-sm text-secondary-400">
                                {/*
                                    한글 질의는 Enter 직행이 막혀 있다(회사명을 URL로 삼으면
                                    없는 페이지로 간다). 그래서 FMP가 색인하지 않는 종목을
                                    한글로 찾으면 **빠져나갈 길이 없다** — 티커로 다시 쳐보라는
                                    안내가 그 유일한 출구다. 데스크톱 자동완성과 같은 문구.
                                */}
                                {isKoreanInput(query)
                                    ? '검색 결과 없음 — 티커(예: AAPL)로 검색해 보세요'
                                    : '검색 결과가 없습니다'}
                            </p>
                        )}
                    </section>
                ) : (
                    <>
                        {recentSearches.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                    <h2 className="text-xs font-medium text-secondary-400">
                                        최근 검색
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            clearAll();
                                            // 이 버튼은 방금 자기 자신이 든 섹션을
                                            // 통째로 언마운트시킨다. 그대로 두면
                                            // 포커스가 <body>로 떨어져 다음 Tab이
                                            // 문서 처음부터 시작한다(WCAG 2.4.3).
                                            inputRef.current?.focus();
                                        }}
                                        className="inline-flex min-h-11 touch-manipulation items-center px-1 text-xs text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        전체 삭제
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 px-4 pb-3">
                                    {/* 오버레이는 상한을 두지 않는다 — 저장된 7개가 다
                                        보여야 "최근 본 종목 사이를 오간다"는 이 화면의
                                        용도가 성립한다. 세로가 귀한 홈 히어로와 달리
                                        여기는 항상 스크롤된다(위 여백 주석 참고). */}
                                    {recentSearches.map(entry => (
                                        <button
                                            key={entry.symbol}
                                            type="button"
                                            onClick={() =>
                                                handleSelect(
                                                    entry.symbol,
                                                    entry.label
                                                )
                                            }
                                            className="min-h-11 max-w-[12rem] touch-manipulation truncate rounded-full border border-primary-500 bg-primary-600/5 px-3 text-xs text-secondary-200 transition-colors hover:border-primary-500/60 hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                        >
                                            {entry.label}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {POPULAR_PREVIEW_GROUPS.map(group => (
                            <section key={group.label}>
                                {/* 자산군을 섹션 제목으로 드러낸다. 인기 종목 데이터
                                    (`{symbol, name}`)에는 거래소 정보가 없어 행마다
                                    시장 배지를 붙일 수 없다 — 없는 정보를 지어내는 대신
                                    제목으로 묶어 한국·코인 사용자가 자기 영역을 바로 찾게 한다. */}
                                <h2 className="px-4 pt-3 pb-1 text-xs font-medium text-secondary-400">
                                    인기 종목 · {group.label}
                                </h2>
                                {group.items.map(item => (
                                    <button
                                        key={item.symbol}
                                        type="button"
                                        onClick={() =>
                                            handleSelect(item.symbol, item.name)
                                        }
                                        className={SEARCH_ROW_CLASS}
                                    >
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-secondary-100">
                                            {item.name}
                                        </span>
                                        <span className="shrink-0 font-mono text-xs text-secondary-400">
                                            {item.symbol}
                                        </span>
                                    </button>
                                ))}
                            </section>
                        ))}
                    </>
                )}
            </div>
        </div>,
        // `isOpen`이 클릭으로만 켜지므로 여기까지 오는 건 클라이언트뿐이지만,
        // 정적 분석은 그 사실을 알 수 없다. 가드를 명시해 서버 렌더 경로에서
        // 브라우저 전역을 읽지 않음을 코드로 드러낸다.
        portalTarget
    );
}
