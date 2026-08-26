import '@testing-library/jest-dom/vitest';
import './vitest.setup.base';

/**
 * jsdom `<dialog>` 폴리필.
 *
 * jsdom은 `HTMLDialogElement.showModal()/close()`를 구현하지 않는다(미구현 API 호출 시
 * `showModal is not a function`). 앱은 모달을 네이티브 `<dialog>`로 띄우므로(포커스 트랩·
 * Esc·비활성 배경을 브라우저에 위임) 테스트 환경에만 최소 구현을 채워 넣는다.
 *
 * 채우는 것: open 속성 토글, Escape 키로 close 이벤트 발생(브라우저의 cancel→close 흐름),
 * close 이벤트 디스패치. 실제 브라우저 동작은 Playwright E2E가 검증한다.
 */
const dialogProto = globalThis.HTMLDialogElement?.prototype;

if (dialogProto !== undefined && typeof dialogProto.showModal !== 'function') {
    const escapeHandlers = new WeakMap<HTMLDialogElement, () => void>();

    const closeDialog = function (
        this: HTMLDialogElement,
        returnValue?: string
    ): void {
        if (!this.open) return;
        this.open = false;
        if (returnValue !== undefined) this.returnValue = returnValue;
        const handler = escapeHandlers.get(this);
        if (handler !== undefined) {
            document.removeEventListener('keydown', handler as EventListener);
            escapeHandlers.delete(this);
        }
        this.dispatchEvent(new Event('close'));
    };

    dialogProto.show = function (this: HTMLDialogElement): void {
        this.open = true;
    };

    dialogProto.showModal = function (this: HTMLDialogElement): void {
        this.open = true;
        const onKeyDown = (event: Event): void => {
            if ((event as KeyboardEvent).key !== 'Escape') return;
            event.preventDefault();
            closeDialog.call(this);
        };
        escapeHandlers.set(this, onKeyDown as () => void);
        document.addEventListener('keydown', onKeyDown);
    };

    dialogProto.close = closeDialog;
}

/*
 * jsdom은 `ResizeObserver`를 구현하지 않는다. 차트 위젯이 pane 높이 변화를
 * 이것으로 추적하므로(`usePaneLabels`·`usePricePaneSize`), StockChart를 렌더하는
 * 모든 테스트가 없이는 `ResizeObserver is not defined`로 죽는다 — matchMedia와
 * 같은 성격의 환경 공백이다.
 *
 * 관찰은 발화하지 않는 no-op이다. 크기 변화 자체를 검증해야 하는 테스트는
 * `vi.stubGlobal('ResizeObserver', ...)`로 각자 덮어쓴다(`usePaneLabels.test.ts` 참조).
 */
if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    } as unknown as typeof ResizeObserver;
}

/*
 * jsdom은 `window.matchMedia`를 구현하지 않는다. 테마 훅(`useTheme`)이 시스템
 * 선호도를 읽고 변경을 구독하므로, 헤더를 렌더하는 모든 테스트가 이것 없이는
 * `TypeError: window.matchMedia is not a function`으로 죽는다.
 *
 * 항상 "다크 선호"(matches: false)를 반환한다 — 앱의 기본 테마와 같아서
 * 스냅샷·클래스 단언이 프로덕션 기본 상태를 그대로 반영한다. 특정 테스트가
 * 라이트 분기를 검증해야 하면 그 테스트에서 이 구현을 덮어쓰면 된다.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
}
