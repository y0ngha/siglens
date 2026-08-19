/**
 * 클라이언트 계측 진입점. Next 16이 **React 하이드레이션 전에** 실행하므로,
 * 마운트된 컴포넌트가 놓치는 하이드레이션 단계의 throw까지 잡힌다.
 *
 * 여기 두는 건 전역 훅뿐이다. React 렌더 중의 throw는 각 `error.tsx` 경계가
 * 직접 `reportClientError`를 부른다(이 훅에는 도달하지 않는다).
 */
import { reportClientError } from '@/shared/lib/reportClientError';

window.addEventListener('error', event => {
    // 리소스 로드 실패(img/script)는 `error`가 없는 이벤트로 온다 — 노이즈라 버린다.
    if (event.error === undefined || event.error === null) return;
    reportClientError(event.error, 'window.onerror');
});

window.addEventListener('unhandledrejection', event => {
    reportClientError(event.reason, 'unhandledrejection');
});
