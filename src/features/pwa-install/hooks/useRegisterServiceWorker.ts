'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '../lib/registerServiceWorker';

/**
 * 마운트 시 서비스 워커를 등록한다. `usePwaInstall`(설치 배너)과 `ServiceWorkerRegistrar`
 * (배너 없는 화면)가 같은 등록 경로를 쓰도록 하나로 둔다. 등록은 모듈 플래그로 한 번만
 * 일어나므로(idempotent) 값이 바뀌어 다시 불려도 무해하다.
 */
export function useRegisterServiceWorker(reloadOnUpdate: boolean): void {
    useEffect(() => {
        registerServiceWorker({ reloadOnUpdate });
    }, [reloadOnUpdate]);
}
