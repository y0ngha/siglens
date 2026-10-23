'use client';

import { useRegisterServiceWorker } from '../hooks/useRegisterServiceWorker';

interface ServiceWorkerRegistrarProps {
    /** `registerServiceWorker`의 `reloadOnUpdate` — 근거는 그 JSDoc. */
    readonly reloadOnUpdate?: boolean;
}

/**
 * 설치 배너 없이 서비스 워커만 등록한다. 렌더 결과가 없다.
 *
 * 평소에는 `PwaBanner`(→ `usePwaInstall`)가 등록까지 맡는다. 배너를 띄우면 안 되는 화면 —
 * SIGLENS AI 점검 중(점검 안내만 여는 앱을 권하지 않는다) — 에서도 오프라인 페이지
 * 프리캐시는 남아야 하므로 등록만 따로 한다(`useRegisterServiceWorker`).
 */
export function ServiceWorkerRegistrar({
    reloadOnUpdate = true,
}: ServiceWorkerRegistrarProps) {
    useRegisterServiceWorker(reloadOnUpdate);
    return null;
}
