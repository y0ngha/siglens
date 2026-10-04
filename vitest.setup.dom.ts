import '@testing-library/jest-dom/vitest';
import './vitest.setup.base';

/**
 * 모든 `render`/`renderHook`을 i18n 프로바이더로 감싼다.
 *
 * 추출 codemod가 컴포넌트에 `useTranslations`를 주입하면서, 조각 렌더 테스트
 * 수백 개가 "프로바이더 밖" 오류로 한꺼번에 깨진다. 테스트마다 `renderWithIntl`로
 * 바꾸는 대신 여기서 한 번 감싼다 — **실제 프로바이더 + 실제 ko 카탈로그**라
 * 기존의 한국어 문자열 단언이 그대로 통과하고, 카탈로그 키가 빠지면 폴백 문자열이
 * 나와 테스트가 진짜로 실패한다(mock이면 조용히 통과한다).
 *
 * 호출자가 준 `wrapper`는 유지한 채 **합성**한다 — 덮어쓰면 QueryClientProvider를
 * 쓰는 테스트가 깨지고, 호출자 쪽이 이기면 i18n이 빠진다.
 *
 * 로케일별 동작을 검증하는 테스트는 `renderWithIntl(ui, { locale })`로 명시한다.
 */
vi.mock('@testing-library/react', async importOriginal => {
    // 둘은 서로 독립이다 — 직렬로 두면 setup이 두 번 왕복한다.
    const [actual, { composeWithIntl }] = await Promise.all([
        importOriginal<typeof import('@testing-library/react')>(),
        import('./src/shared/test-utils/intlRenderWrapper'),
    ]);
    return {
        ...actual,
        render: (
            ui: Parameters<typeof actual.render>[0],
            options?: Parameters<typeof actual.render>[1]
        ) =>
            actual.render(ui, {
                ...options,
                wrapper: composeWithIntl(options?.wrapper),
            }),
        renderHook: (
            hook: Parameters<typeof actual.renderHook>[0],
            options?: Parameters<typeof actual.renderHook>[1]
        ) =>
            actual.renderHook(hook, {
                ...options,
                wrapper: composeWithIntl(options?.wrapper),
            }),
    };
});

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

/*
 * happy-dom 네트워크 가드.
 *
 * `vitest.setup.base.ts`의 거부형 `fetch`는 **전역** `fetch`만 막는다. happy-dom은
 * 그와 별개로 자기 창 내부의 fetch 구현을 들고 있고, `navigator.sendBeacon`·
 * `XMLHttpRequest`·리소스 로딩이 전역을 거치지 않고 그 내부 구현을 직접 부른다.
 * jsdom에서 happy-dom으로 바꾸면서 실제로 드러난 경로가 `sendBeacon`이다 —
 * jsdom에는 없어서 `reportClientError`가 조기 반환했는데, happy-dom에는 있어서
 * 에러 경계를 렌더하는 테스트들이 `http://localhost:4200/api/client-error`로 진짜
 * 요청을 보냈다(로컬 dev 서버가 떠 있으면 그 서버에 도달한다).
 *
 * 그래서 두 겹으로 막는다.
 *
 * 1. 인터셉터 — happy-dom 내부 fetch가 나가기 전에 던진다. 전역 가드와 같은
 *    원칙이다: 목이 없는 네트워크 호출은 조용히 나가지 않고 시끄럽게 실패한다.
 * 2. `sendBeacon` 제거 — jsdom과 같은 "없음" 상태로 맞춘다. 남겨 두면 에러 경계를
 *    렌더하는 테스트마다 1번 가드가 unhandled rejection으로 터진다(전송은
 *    fire-and-forget이라 잡을 곳이 없다). 전송 자체를 검증하는 테스트는 jsdom
 *    때와 똑같이 각자 `sendBeacon`을 정의해서 쓴다.
 *
 * `// @vitest-environment jsdom` 파일에서는 `happyDOM` 전역이 없으므로 통째로 건너뛴다.
 */
interface HappyDomNetworkSettings {
    settings: {
        fetch: {
            interceptor: {
                beforeAsyncRequest: (context: {
                    request: { url: string };
                }) => Promise<never>;
                beforeSyncRequest: (context: {
                    request: { url: string };
                }) => never;
            } | null;
        };
    };
}

const happyDomApi = (globalThis as { happyDOM?: HappyDomNetworkSettings })
    .happyDOM;

if (happyDomApi !== undefined) {
    const unmockedNetworkError = (url: string): Error =>
        new Error(
            `Unmocked network call from happy-dom (${url}) — mock it explicitly. A real network call from a test is not allowed.`
        );

    happyDomApi.settings.fetch.interceptor = {
        beforeAsyncRequest: ({ request }) =>
            Promise.reject(unmockedNetworkError(request.url)),
        beforeSyncRequest: ({ request }) => {
            throw unmockedNetworkError(request.url);
        },
    };

    Object.defineProperty(navigator, 'sendBeacon', {
        value: undefined,
        writable: true,
        configurable: true,
    });
}
