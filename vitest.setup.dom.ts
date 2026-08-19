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
    const actual =
        await importOriginal<typeof import('@testing-library/react')>();
    const { composeWithIntl } =
        await import('./src/shared/test-utils/intlRenderWrapper');
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
