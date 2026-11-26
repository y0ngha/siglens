import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/**
 * `ui`를 act 밖에서 동기 렌더 한 번만 돌리고, 그 첫 커밋의 DOM을 `inspect`에 넘긴다.
 *
 * RTL `render`는 act로 감싸 effect와 transition 갱신을 전부 비운 뒤 돌려주므로 "첫 렌더에
 * 이미 있었는가"를 구분하지 못한다(effect에서 상태를 채우는 옛 구현도 통과한다). 여기서는
 * `IS_REACT_ACT_ENVIRONMENT`를 끄고 `flushSync`로 동기 렌더만 실행한다.
 *
 * 환경 플래그 복원, 언마운트, 컨테이너 제거는 `inspect`가 던져도 항상 실행된다.
 */
export function renderWithoutAct(
    ui: ReactElement,
    inspect: (container: HTMLElement) => void
): void {
    const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prevActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
    globals.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
        flushSync(() => root.render(ui));
        inspect(container);
    } finally {
        flushSync(() => root.unmount());
        container.remove();
        globals.IS_REACT_ACT_ENVIRONMENT = prevActEnvironment;
    }
}
