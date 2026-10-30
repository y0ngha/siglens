'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { useOverlaySearch } from '../hooks/useOverlaySearch';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useSearchAnnouncement } from '../hooks/useSearchAnnouncement';
import { normalizeLabel } from '../lib/normalizeLabel';
import { SEARCH_PLACEHOLDER_KEY } from '../lib/searchLabels';
import { OverlayPopularPreview } from './search-overlay/OverlayPopularPreview';
import { OverlayRecentSearches } from './search-overlay/OverlayRecentSearches';
import { OverlayResults } from './search-overlay/OverlayResults';

interface SearchOverlayProps {
    isOpen: boolean;
    /** 사용자가 명시적으로 닫을 때. 히스토리 항목을 되돌린다. */
    onClose: () => void;
    /** 종목으로 이동한다. 오버레이를 닫고 이동을 시작하는 책임은 provider에 있다. */
    onNavigate: (symbol: string) => void;
}

/**
 * 모바일 전체화면 검색 오버레이. `SearchOverlayProvider`가 앱 전체에 하나만 호스팅한다.
 *
 * ## 포털이 필수인 이유
 *
 * `Header`는 `sticky z-50 backdrop-blur-md`다. CSS 명세상 `backdrop-filter`는
 * (`transform`·`filter`와 마찬가지로) **`position: fixed` 자손의 containing block**이
 * 된다. 헤더 안에서 렌더하면 `fixed inset-0`가 뷰포트가 아니라 **56px 헤더 박스**
 * 기준으로 잡혀 오버레이가 헤더 영역만 덮는다(`widgets/layout/HeaderMobileMenu`도 같은 이유).
 *
 * ## z-70인 이유
 *
 * `/[symbol]`에는 `AskAiFab`이 `z-60`으로 상주한다. `z-50`이면 그 링크가
 * 오버레이 **위에** 뜬다. 헤더(50)·vaul 시트(50)·넛지 모달(50)·PopoverSurface(60)까지
 * 모두 넘으려면 70이 필요하다.
 *
 * ## 포커스: `autoFocus`이지 `useFocusTrap`의 자동 포커스가 아니다
 *
 * `useFocusTrap`은 활성화 시 컨테이너의 **첫 포커서블**로 포커스를 옮기는데, 그건
 * `useEffect`(passive)라 탭 태스크보다 늦다. iOS Safari는 사용자 제스처와 동기적으로
 * 이어지지 않은 `focus()`로는 키보드를 올리지 않는다.
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
    // 호스팅해 전 라우트에 마운트돼 있다. 본체의 훅이 여기 있으면 라우트가 바뀔 때마다
    // `useRecentSearches`의 동기 `localStorage` 읽기 + `JSON.parse`와 React Query
    // observer 하나가 클라이언트 내비게이션의 임계 경로에 딸려온다.
    //
    // 분리는 하이드레이션 게이트도 겸한다. 서버 HTML에는 포털이 없고 `isOpen`은
    // 클릭으로만 true가 되므로 첫 클라이언트 렌더에도 포털이 없다(React #418).
    // 지난 질의가 남지 않는 것도 언마운트가 보장한다.
    if (!isOpen) return null;
    return <SearchOverlayBody onClose={onClose} onNavigate={onNavigate} />;
}

function SearchOverlayBody({
    onClose,
    onNavigate,
}: Omit<SearchOverlayProps, 'isOpen'>) {
    const t = useTranslations('features.ticker-search');

    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 로케일 접두사를 뗀 경로다 — `/en/NVDA`에서도 `NVDA` 재선택을 "같은 페이지"로 알아봐야 한다.
    const pathname = useAppPathname();
    const { recentSearches, addSearch, clearAll } = useRecentSearches();
    const { query, results, hasQuery, status, handleChange, handleKeyDown } =
        useOverlaySearch(target => handleSelect(target.symbol, target.label));
    const announcement = useSearchAnnouncement(status, results.length);

    // 본체는 열려 있을 때만 마운트된다 — 항상 활성.
    useEscapeKey(onClose, true);
    useFocusTrap(dialogRef, true);
    // 배경 스크롤 잠금. 소유자 수를 세는 훅이라 다른 잠금과 겹쳐 열려도 안전하다.
    useBodyScrollLock();

    /**
     * 결과·최근·인기·검색 키 모든 경로가 거치는 단일 선택 경로.
     *
     * 라우터를 직접 만지지 않는다 — 무엇을 골랐는지만 `onNavigate`로 넘기고, 실제 이동
     * (`router.replace`)과 진행 바는 `SearchOverlayProvider`가 소유한다. 오버레이는 즉시
     * 닫혀야 하므로(이동이 멈춰도 전체화면 모달에 갇히지 않게, WCAG 2.1.2) 대기 표시를
     * 오버레이 밖에서 이어 가야 하기 때문이다.
     */
    function handleSelect(symbol: string, label: string) {
        addSearch({ symbol, label: normalizeLabel(label, symbol) });
        // 보고 있던 종목을 다시 고른 경우. 이동할 곳이 없으니 닫기만 한다 — `onClose`가
        // 열 때 넣은 히스토리 항목을 되돌린다. `onNavigate`로 보내면 같은 URL로의
        // `replace`가 그 항목을 소비하지 않은 채 남겨, 다음 닫기의 `history.back()`이
        // 사용자를 보던 페이지 밖으로 보낸다.
        if (pathname === `/${symbol}`) {
            onClose();
            return;
        }
        onNavigate(symbol);
    }

    function handleClearAll() {
        clearAll();
        // 최근 검색 섹션이 통째로 언마운트되므로 포커스를 입력으로 돌린다(WCAG 2.4.3).
        inputRef.current?.focus();
    }

    const portalTarget = typeof document === 'undefined' ? null : document.body;
    if (!portalTarget) return null;

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('search.overlayLabel')}
            // 포커스 불가한 여백을 탭했을 때 포커스가 body로 떨어지지 않게 한다 —
            // 그러면 focus trap의 edge-wrap이 동작하지 않아 다음 Tab이 오버레이 뒤의
            // 헤더 컨트롤로 새어 나간다(보이지 않는 포커스, WCAG 2.4.11).
            tabIndex={-1}
            // h-dvh는 iOS의 URL 바 노출/숨김에 따라 높이를 맞추기 위한 것이다.
            // **키보드는 dvh에 반영되지 않는다** — 키보드에 가려지는 문제는 아래
            // 스크롤 컨테이너의 하단 여백이 해결한다.
            className="fixed inset-0 z-70 flex h-dvh flex-col bg-secondary-900"
        >
            {/* `viewportFit: cover` + standalone PWA에서 `fixed inset-0`는 화면 물리
                최상단에서 시작한다. 상단 인셋을 주지 않으면 입력과 취소 버튼이
                상태바 아래에 깔린다(WCAG 2.4.11). */}
            <div className="flex items-center gap-2 border-b border-secondary-700 px-3 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
                {/* 입력이 DOM 순서상 첫 포커서블이어야 한다 — 위 JSDoc 참고. */}
                <input
                    ref={inputRef}
                    // iOS 키보드를 띄우려면 탭 태스크와 같은 commit에서 포커스가 잡혀야
                    // 한다. effect 기반 포커스는 늦다 — 위 JSDoc의 "포커스" 절 참고.
                    autoFocus
                    type="search"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t(SEARCH_PLACEHOLDER_KEY)}
                    // 보이는 문구(placeholder)와 접근 이름을 같게 둔다 —
                    // 음성 입력 사용자가 화면에 보이는 말로 이 필드를 부를 수 있어야 한다
                    // (WCAG 2.5.3).
                    aria-label={t(SEARCH_PLACEHOLDER_KEY)}
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
                    {t('search.cancel')}
                </button>
            </div>

            {/*
                overscroll-contain — 목록 끝에서 스크롤이 배경으로 넘어가지 않게 한다.

                `pb-[100dvh]`가 핵심이다. 이게 없으면 콘텐츠 높이가 컨테이너를 넘지 않아
                (`scrollHeight === clientHeight`) **스크롤 자체가 불가능**하다. 뷰포트는
                키보드가 올라와도 `dvh` 그대로라(레이아웃 뷰포트 기준) 컨테이너는 844px인데
                실제로 보이는 건 ~354px뿐이다(390×844 실측). 여백이 **키보드 높이 이상**이어야
                마지막 행이 키보드 위로 올라오고, iOS에서 아래로 끌어 키보드를 내리는 제스처도
                함께 동작한다. 빈 공간이라 바이트도 페인트 비용도 0이므로 100dvh로 둔다.
            */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[100dvh]">
                {/*
                    이 리전은 오버레이가 열릴 때 내용(`검색어를 입력하세요`)과 함께
                    삽입된다. 그 첫 문구는 놓칠 수 있지만 이후의 모든 변화(검색 중 →
                    결과 N건 / 실패)는 리전이 이미 등록된 뒤라 정상적으로 읽힌다.
                */}
                <p className="sr-only" aria-live="polite">
                    {announcement}
                </p>

                {hasQuery ? (
                    <OverlayResults
                        results={results}
                        status={status}
                        onSelect={handleSelect}
                    />
                ) : (
                    <>
                        {recentSearches.length > 0 && (
                            <OverlayRecentSearches
                                entries={recentSearches}
                                onSelect={handleSelect}
                                onClearAll={handleClearAll}
                            />
                        )}
                        <OverlayPopularPreview onSelect={handleSelect} />
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
