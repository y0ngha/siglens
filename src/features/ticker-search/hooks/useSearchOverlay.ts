'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { reportClientError } from '@/shared/lib/reportClientError';

interface UseSearchOverlayReturn {
    isOpen: boolean;
    open: () => void;
    /** 사용자가 명시적으로 닫을 때(취소·Escape). 우리가 넣은 히스토리 항목을 되돌린다. */
    close: () => void;
    /**
     * 종목으로 이동하면서 닫을 때. **히스토리를 건드리지 않는다** —
     * `router.replace`가 우리 항목을 목적지로 이미 대체했으므로 되돌릴 것이 없다.
     *
     * 우리가 넣어 둔 히스토리 항목이 있는지를 돌려준다. 호출부는 이 값으로
     * `replace`(대체할 항목이 있다)와 `push`(없다)를 갈라야 한다.
     */
    dismissForNavigation: () => boolean;
}

/**
 * 우리가 넣은 히스토리 항목임을 devtools에서 알아볼 수 있게 하는 표식.
 *
 * **판정에는 쓰지 않는다** — `popstate`는 `pushedRef`만 보고 닫는다. 오버레이가 열린
 * 동안 오는 히스토리 이동은 출처와 무관하게 전부 닫아야 하므로, 항목을 구분할 이유가
 * 없다. `history.state`는 Next가 자기 내부 상태를 병합해 덮어쓰기도 해서 신뢰 대상도
 * 아니다(위 `pushedRef` 주석 참고).
 */
const SEARCH_HISTORY_MARKER = 'siglensSearch';

/**
 * 전체화면 검색 오버레이의 열림 상태와 **뒤로가기 배선**만 담당한다.
 * 검색 로직은 전혀 모른다 — 그래서 단독으로 테스트된다.
 *
 * ## 왜 히스토리를 쓰는가
 *
 * 검색은 목적지가 아니라 **경유지**다. `NVDA`를 보다가 검색해 `AAPL`로 가는 흐름에서
 * 뒤로가기는 `AAPL → NVDA`여야 한다. 그래서 열 때 항목을 하나 넣고, 종목으로 이동할 때
 * 호출부가 `router.replace`로 그 항목을 **대체**한다(`router.push`면 히스토리가
 * `[NVDA, 검색, AAPL]`이 되어 뒤로가기가 빈 검색 화면을 거친다).
 *
 * 안드로이드 뒤로가기·iOS 스와이프는 이 항목을 pop하는 것으로 오버레이를 닫는다.
 * 항목을 넣지 않으면 뒤로가기가 **사이트를 떠나버려** 사용자가 보던 종목을 잃는다.
 *
 * ## `pushState`에 URL을 넘기지 않는 이유 (중요)
 *
 * Next 16은 `history.pushState`를 패치한다(`app-router.js`). 3번째 인자 `url`이
 * truthy면 `applyUrlFromHistoryPushReplace`가 `ACTION_RESTORE`를 디스패치하고, 그
 * 후속 동기 effect가 `replaceState({ __NA: true, ... })`로 **우리가 넣은 state를
 * 덮어쓴다**. 덤으로 보이는 링크 재프리페치까지 도는데, 하필 키보드를 올려야 할
 * 바로 그 탭에서 메인스레드를 가져간다.
 *
 * URL을 생략하면 패치의 `if (url)` 가드에 걸려 전부 스킵되고, 현재 URL은 그대로
 * 유지된다(MDN: `url` 생략 시 현재 문서 URL 유지). 그래서 우리 state도 살아남는다.
 *
 * 다만 `router.replace` 이후에는 Next가 목적지 항목을 자기 state로 다시 쓰므로,
 * **`history.state`를 신뢰하는 로직은 만들지 않는다.** "우리가 항목을 넣었는가"는
 * 아래 `pushedRef`로만 판단한다.
 *
 * ## 닫기를 pathname 변화에 묶는 이유
 *
 * `Header`는 root layout에 있어 클라이언트 내비게이션에도 언마운트되지 않는다.
 * 그래서 `router.replace` 후에도 오버레이가 목적지 페이지 위에 그대로 남는다.
 * `usePathname()` 변화 한 곳에서 닫으면 select-close·back-close·forward-close가
 * 모두 해결된다(`widgets/layout/HeaderMobileMenu`가 같은 패턴을 쓴다).
 */
export function useSearchOverlay(): UseSearchOverlayReturn {
    const [isOpen, setIsOpen] = useState(false);

    /**
     * 우리가 히스토리 항목을 넣어 둔 상태인지. `history.state`는 Next가 덮어쓰므로
     * 신뢰할 수 없어 ref로 따로 추적한다. 리셋이 누락되면 두 번째 열기가 `pushState`를
     * 건너뛰고, 그러면 안드로이드 뒤로가기가 오버레이가 아니라 **사이트를 떠난다**.
     */
    const pushedRef = useRef(false);

    /**
     * 오버레이를 연 트리거. 닫을 때 여기로 포커스를 되돌린다.
     *
     * `useFocusTrap`의 자동 복원에 기댈 수 없다 — 그 훅은 활성화 시점의
     * `document.activeElement`를 "이전 포커스"로 기억하는데, 우리는 입력에 `autoFocus`를
     * 걸어 두어(iOS 키보드 때문에, `SearchOverlay` JSDoc 참고) 그 시점엔 이미 포커스가
     * **오버레이 입력**으로 옮겨간 뒤다. 그래서 훅은 사라질 입력을 기억하고, 닫힐 때
     * `document.contains()` 검사에 걸려 아무것도 복원하지 못한다 → 포커스가 `<body>`로
     * 떨어진다(WCAG 2.4.3).
     *
     * `open()`은 클릭 핸들러에서 동기적으로 불리므로 이 시점의 `activeElement`가 곧
     * 트리거다. 다만 iOS Safari는 탭으로 `<button>`에 포커스를 주지 않아 이 값이
     * `<body>`인 경우가 흔하다 — 그때 복원은 무해한 no-op이고, 터치 사용자는 애초에
     * 포커스 링을 쓰지 않는다. 키보드·데스크톱 경로에서는 실제 트리거가 잡힌다.
     */
    const triggerRef = useRef<HTMLElement | null>(null);

    /**
     * 닫힘이 커밋된 뒤 포커스를 되돌려야 한다는 표식. 상태를 내린 **직후**에 포커스를
     * 옮기면 포털이 아직 DOM에 있어 트랩이 다시 가져갈 수 있으므로, 실제 복원은
     * 아래 `[isOpen]` 효과가 커밋 이후에 수행한다.
     */
    const pendingRestoreRef = useRef(false);

    const pathname = usePathname();

    const open = useCallback(() => {
        // `pushState`는 부수효과라 setState 업데이터 안에 두면 안 된다 — React가
        // StrictMode에서 업데이터를 두 번 호출해 히스토리 항목이 두 개 쌓인다.
        // `open`은 이벤트 핸들러에서만 불리므로 여기서 바로 처리한다.
        triggerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        if (!pushedRef.current) {
            // 2번째 인자는 레거시 `title` — 명세상 빈 문자열이 권장이다.
            // 3번째(url)는 위 JSDoc대로 **넘기지 않는다**.
            try {
                // Next의 `pushState` 패치는 우리 state 위에 자기 내부 키
                // (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`)를 복사해 얹는다
                // (`copyNextJsInternalHistoryState`). 그 `__NA`가 있어야 Next의
                // `onPopState`가 이 항목을 인정하고 넘어간다 — 없으면 뒤로가기가
                // `window.location.reload()`로 빠져 **전체 새로고침**이 된다.
                history.pushState({ [SEARCH_HISTORY_MARKER]: true }, '');
                pushedRef.current = true;
            } catch (error) {
                // Safari는 짧은 시간에 `pushState`가 몰리면 `SecurityError`를 던진다.
                // 이벤트 핸들러라 React 에러 바운더리가 잡지 못하고, 여기서 멈추면
                // **돋보기를 눌러도 영영 아무 일도 안 일어난다**. 히스토리 항목 없이라도
                // 오버레이는 연다 — 뒤로가기로 닫지 못할 뿐 검색은 쓸 수 있다.
                reportClientError(error, 'useSearchOverlay.open');
            }
        }
        setIsOpen(true);
    }, []);

    const restoreFocus = useCallback(() => {
        pendingRestoreRef.current = true;
    }, []);

    /**
     * 사용자가 명시적으로 닫을 때(닫기 버튼·Escape). 우리가 넣은 항목을 되돌려
     * 히스토리에 유령 항목이 남지 않게 한다. 실제 상태 전환은 `popstate` 핸들러가 맡는다.
     */
    const close = useCallback(() => {
        if (pushedRef.current) {
            // `back()` **전에** 내린다. popstate가 도착하기까지 오버레이는 아직 떠
            // 있어서, 그 사이 두 번째 `close()`가 들어오면(취소 더블탭, Escape 키반복,
            // 현재 종목 행 더블탭) 두 칸을 물러나 사용자를 종목 페이지 밖으로 던진다.
            pushedRef.current = false;
            history.back();
            return;
        }
        setIsOpen(false);
        restoreFocus();
    }, [restoreFocus]);

    /**
     * 이동과 함께 닫는다. `close()`와 달리 `history.back()`을 부르지 않는다.
     *
     * 선택 시 `router.replace`가 우리가 넣은 항목을 목적지로 대체하므로, 그 뒤에
     * `back()`을 부르면 **방금 한 이동을 취소해** 사용자를 원래 종목으로 되돌린다.
     * 포커스도 되돌리지 않는다 — 트리거는 떠나온 페이지의 것이고, 사용자는 새 페이지의
     * 시작점에서 읽어야 한다.
     *
     * 돌려주는 값은 "대체할 항목이 있는가"다. `pushState`가 실패했을 때(Safari
     * `SecurityError`) false가 되는데, 그 상태에서 호출부가 `replace`를 쓰면 우리
     * 항목이 아니라 **사용자가 보던 페이지의 항목**을 덮어써 뒤로가기가 그 페이지를
     * 건너뛴다.
     */
    const dismissForNavigation = useCallback(() => {
        // `pushedRef`는 **내리지 않는다**. `router.replace`는 RSC 응답이 올 때까지
        // 히스토리를 건드리지 않는데(LAX 경로에서 2~3초), 그 사이 사용자가 검색을
        // 다시 열면 `open()`이 항목을 하나 더 밀어 넣는다. 그러면 뒤늦게 도착한
        // replace가 **새 항목**을 덮어쓰고 먼저 넣은 항목이 고아로 남아, 뒤로가기가
        // 한 번 헛돈다.
        //
        // true로 두면 재열기가 기존 항목을 재사용하고, replace가 그 항목을 목적지로
        // 바꾸며, `[pathname]` 효과가 ref를 정리한다. 이동이 끝내 실패해도 항목이
        // 그대로 남아 뒤로가기 **한 번이 소모된다**(같은 URL이라 화면은 그대로) —
        // 사이트를 떠나는 것보다 낫다는 판단이다.
        //
        // 이동 중 사용자가 검색을 다시 열면, 뒤늦게 도착한 이동이 `pathname`을 바꾸며
        // 그 오버레이를 닫는다. "라우트가 바뀌면 항상 닫는다"는 규칙과 일관되므로
        // 예외를 두지 않는다.
        triggerRef.current = null;
        setIsOpen(false);
        return pushedRef.current;
    }, []);

    /**
     * 오버레이가 사라진 뒤 트리거로 포커스를 돌려준다(WCAG 2.4.3).
     *
     * 처음에는 `requestAnimationFrame`으로 다음 프레임에 걸었는데, **숨겨진 탭에서는
     * rAF가 아예 돌지 않아** 복원이 조용히 건너뛰어졌다(실증에서 focusin 이벤트가
     * 한 건도 안 잡혔다). effect는 커밋 직후 항상 실행되므로 탭 상태와 무관하다.
     */
    useEffect(() => {
        if (isOpen || !pendingRestoreRef.current) return;
        pendingRestoreRef.current = false;
        const trigger = triggerRef.current;
        triggerRef.current = null;
        // 이동으로 라우트가 바뀐 경우 트리거는 이미 사라졌을 수 있다.
        if (trigger && document.contains(trigger)) trigger.focus();
    }, [isOpen]);

    useEffect(() => {
        const handlePopState = () => {
            // 항목 추적은 **열림 여부와 무관하게** 내린다. `dismissForNavigation`
            // 직후(이동 대기 2~3초)에 뒤로가기가 들어오는 경우가 있는데, 우리가 넣은
            // 항목은 URL을 바꾸지 않으므로 그 뒤로가기로는 `pathname`도 바뀌지 않는다
            // — 즉 `[pathname]` 효과가 정리해 주지 못하고 여기가 유일한 정리 지점이다.
            // 남겨 두면 다음 열기가 `pushState`를 건너뛰고, 그다음 닫기의
            // `history.back()`이 이미 사라진 항목을 상대해 사용자를 한 페이지 더
            // 뒤로 보낸다.
            pushedRef.current = false;

            // 반면 **복원 표식과 상태 전환은 열려 있을 때만** 한다. 이 훅은 root
            // layout의 provider에 있어 앱의 모든 뒤로가기가 여기로 오므로, 닫힌
            // 상태에서 표식을 세우면 그게 다음 실제 닫기까지 남아 효과의 가드가
            // 무의미해진다.
            if (!isOpen) return;
            setIsOpen(false);
            restoreFocus();
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, restoreFocus]);

    // 라우트가 바뀌면(선택 후 이동 포함) 오버레이는 항상 닫힌다. `router.replace`가
    // 우리 항목을 목적지로 대체했으므로 되돌릴 항목도 더는 없다.
    useEffect(() => {
        pushedRef.current = false;
        // 라우트가 바뀐 경우엔 포커스를 되돌리지 않는다 — 트리거는 이전 페이지의
        // 것이고, 사용자는 새 페이지의 시작점에서 읽기 시작해야 한다.
        triggerRef.current = null;
        setIsOpen(false);
    }, [pathname]);

    return { isOpen, open, close, dismissForNavigation };
}
