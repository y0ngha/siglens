import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef = { current: '/NVDA' };
vi.mock('next/navigation', () => ({
    usePathname: () => pathnameRef.current,
}));

import { useSearchOverlay } from '@/features/ticker-search/hooks/useSearchOverlay';

/**
 * 이 훅의 계약은 "검색은 목적지가 아니라 경유지"라는 한 문장으로 요약된다.
 * 아래 테스트는 그 문장이 히스토리 동작으로 지켜지는지만 본다 — 검색 로직은 여기 없다.
 */
describe('useSearchOverlay', () => {
    let pushSpy: ReturnType<typeof vi.spyOn>;
    let backSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        pathnameRef.current = '/NVDA';
        pushSpy = vi.spyOn(history, 'pushState').mockImplementation(() => {});
        backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('열면 히스토리 항목을 하나 넣는다', () => {
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        expect(result.current.isOpen).toBe(true);
        expect(pushSpy).toHaveBeenCalledTimes(1);
    });

    it('pushState에 URL을 넘기지 않는다', () => {
        // URL을 넘기면 Next의 app-router 패치가 ACTION_RESTORE를 태우고 후속
        // replaceState가 우리 state를 덮어쓴다. 덤으로 링크 재프리페치까지 돈다 —
        // 하필 키보드를 올려야 할 탭에서. 인자 개수 자체가 계약이다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        const args = pushSpy.mock.calls[0];
        expect(args?.[2]).toBeUndefined();
    });

    it('이미 열린 상태에서 다시 열어도 항목이 쌓이지 않는다', () => {
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => result.current.open());

        expect(pushSpy).toHaveBeenCalledTimes(1);
    });

    it('popstate가 오면 닫힌다', () => {
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(result.current.isOpen).toBe(false);
    });

    it('popstate로 닫힌 뒤 다시 열면 항목을 새로 넣는다', () => {
        // 리셋이 누락되면 두 번째 열기가 pushState를 건너뛰고, 그러면 안드로이드
        // 뒤로가기가 오버레이가 아니라 **사이트를 떠난다**.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        act(() => result.current.open());

        expect(pushSpy).toHaveBeenCalledTimes(2);
    });

    it('닫기 버튼은 history.back()으로 우리 항목을 되돌린다', () => {
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => result.current.close());

        expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it('항목을 넣지 않은 상태의 close는 back을 부르지 않는다', () => {
        // 복원된 세션 등 우리가 푸시하지 않은 상태에서 back을 부르면 사용자를
        // 엉뚱한 페이지로 보낸다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.close());

        expect(backSpy).not.toHaveBeenCalled();
    });

    it('닫을 때 포커스를 연 트리거로 되돌린다', async () => {
        // `useFocusTrap`의 자동 복원은 여기서 동작하지 않는다 — 입력에 `autoFocus`가
        // 걸려 있어 트랩이 활성화될 땐 이미 포커스가 오버레이 안이고, 그 요소는
        // 닫힐 때 사라져 `document.contains()` 검사에 걸린다(WCAG 2.4.3).
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        // 오버레이가 포커스를 가져간 상황을 흉내낸다.
        const inner = document.createElement('input');
        document.body.appendChild(inner);
        inner.focus();
        expect(document.activeElement).toBe(inner);

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        inner.remove();

        await waitFor(() => expect(document.activeElement).toBe(trigger));
        trigger.remove();
    });

    it('close를 두 번 불러도 뒤로 한 번만 간다', () => {
        // `back()`과 popstate 사이엔 오버레이가 아직 떠 있다. 그 창에서 두 번째
        // close가 들어오면(취소 더블탭·Escape 키반복) 두 칸을 물러나 사용자를
        // 종목 페이지 밖으로 던진다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => {
            result.current.close();
            result.current.close();
        });

        expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it('이동용 닫기는 히스토리를 건드리지 않는다', () => {
        // `router.replace`가 우리 항목을 목적지로 이미 대체했으므로 되돌릴 것이 없다.
        // 여기서 back()이 돌면 방금 한 이동이 취소된다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => result.current.dismissForNavigation());

        expect(result.current.isOpen).toBe(false);
        expect(backSpy).not.toHaveBeenCalled();
    });

    it('이동 중 다시 열면 기존 항목을 재사용한다', () => {
        // `router.replace`는 RSC 응답이 올 때까지 히스토리를 건드리지 않는다(LAX 경로
        // 2~3초). 그 사이 재열기가 항목을 하나 더 밀어 넣으면, 뒤늦게 도착한 replace가
        // **새 항목**을 덮어쓰고 먼저 넣은 항목이 고아로 남아 뒤로가기가 한 번 헛돈다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => result.current.dismissForNavigation());
        act(() => result.current.open());

        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(result.current.isOpen).toBe(true);
    });

    it('이동 대기 중 뒤로가기가 들어오면 항목 추적을 정리한다', () => {
        // `dismissForNavigation` 뒤 이동이 도착하기까지 2~3초가 걸린다(LAX 경로).
        // 그 사이의 뒤로가기는 우리 항목을 pop하지만 URL은 그대로라 `pathname`이
        // 바뀌지 않는다 — 즉 popstate가 유일한 정리 지점이다. 놓치면 다음 열기가
        // pushState를 건너뛰고, 그다음 닫기의 back()이 이미 사라진 항목을 상대해
        // 사용자를 한 페이지 더 뒤로 보낸다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => {
            result.current.dismissForNavigation();
        });
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        act(() => result.current.open());
        expect(pushSpy).toHaveBeenCalledTimes(2);
    });

    it('이동이 끝나면(pathname 변화) 항목 추적이 정리된다', () => {
        // 재사용 설계의 반대편 — replace가 항목을 목적지로 바꿨으므로 추적을 놓아야
        // 다음 열기가 새 항목을 넣는다.
        const { result, rerender } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        act(() => result.current.dismissForNavigation());

        pathnameRef.current = '/AAPL';
        rerender();

        act(() => result.current.open());
        expect(pushSpy).toHaveBeenCalledTimes(2);
    });

    it('라우트가 바뀌면 닫히고 항목 추적도 초기화된다', () => {
        // 선택 후 router.replace로 이동한 경우다. Header는 root layout에 있어
        // 언마운트되지 않으므로, 이걸 안 하면 오버레이가 목적지 위에 남는다.
        const { result, rerender } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        pathnameRef.current = '/AAPL';
        rerender();

        expect(result.current.isOpen).toBe(false);

        // 이동으로 항목이 소비됐으므로 다음 열기는 새로 푸시해야 한다.
        act(() => result.current.open());
        expect(pushSpy).toHaveBeenCalledTimes(2);
    });

    it('pushState가 막혀도 오버레이는 열린다', () => {
        // Safari는 짧은 시간에 pushState가 몰리면 SecurityError를 던진다. 이벤트
        // 핸들러라 React 에러 바운더리가 잡지 못하고, 여기서 멈추면 **돋보기를 눌러도
        // 영영 아무 일도 안 일어난다**. 뒤로가기로 닫지 못할 뿐 검색은 쓸 수 있어야 한다.
        pushSpy.mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const { result } = renderHook(() => useSearchOverlay());

        act(() => result.current.open());

        expect(result.current.isOpen).toBe(true);
    });

    it('이동용 닫기는 우리 항목이 있었는지를 돌려준다', () => {
        // 호출부는 이 값으로 replace(대체할 항목 있음)와 push(없음)를 가른다.
        // 항목이 없는데 replace를 쓰면 사용자가 보던 페이지의 항목을 덮어쓴다.
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        let hadEntry: boolean | undefined;
        act(() => {
            hadEntry = result.current.dismissForNavigation();
        });
        expect(hadEntry).toBe(true);
    });

    it('pushState가 막혔으면 이동용 닫기가 false를 돌려준다', () => {
        pushSpy.mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());

        let hadEntry: boolean | undefined;
        act(() => {
            hadEntry = result.current.dismissForNavigation();
        });
        expect(hadEntry).toBe(false);
    });

    it('이동으로 닫을 때는 포커스를 되돌리지 않는다', () => {
        // 트리거는 떠나온 페이지의 것이다. 되돌리면 사용자가 새 페이지의 시작점이
        // 아니라 옛 헤더의 버튼에서 읽기 시작한다.
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const { result } = renderHook(() => useSearchOverlay());
        act(() => result.current.open());
        const inner = document.createElement('input');
        document.body.appendChild(inner);
        inner.focus();

        act(() => {
            result.current.dismissForNavigation();
        });
        inner.remove();

        expect(document.activeElement).not.toBe(trigger);
        trigger.remove();
    });
});
