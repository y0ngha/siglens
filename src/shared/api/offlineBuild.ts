/**
 * pre-push 로컬 빌드가 프로덕션 FMP/Neon/Upstash에 닿지 않도록 막는 게이트.
 *
 * WHY: 로컬 `yarn build`는 `.env.local`(프로덕션 자격증명)을 그대로 로드한 채
 * `/economy`, `/market`, `/fear-greed`, `news/[category]`, 법적 페이지, 홈을
 * prerender하며 실제 FMP/Neon/Upstash를 호출한다. 이 출력은 버려지므로 degrade된
 * 결과라도 무해하다 — 문제는 프로덕션 서비스에 불필요한 부하/비용을 주는 쪽이다.
 *
 * `SIGLENS_OFFLINE_BUILD=1`은 `.husky/pre-push`만 설정한다. Docker 배포 빌드는
 * ISR S3 캐시가 GIT_SHA별이라 반대로 실데이터가 반드시 필요하므로 이 플래그를
 * 절대 켜면 안 된다(`Dockerfile` / `.github/workflows/deploy.yml`에 추가 금지).
 *
 * 각 호출부(FMP/Neon/Upstash 어댑터)는 이 서비스들이 unreachable일 때 이미
 * graceful하게 degrade하도록 되어 있으므로(캐시 미스/빈 배열/null 반환), 여기서는
 * 네트워크 호출 자체를 사전에 막기만 하면 된다.
 */
export function isOfflineBuild(): boolean {
    return process.env.SIGLENS_OFFLINE_BUILD === '1';
}

const warnedServices = new Set<string>();

/**
 * 서비스별로 프로세스당 한 번만 `[offline-build]` 경고를 남긴다.
 *
 * 각 어댑터가 차단 에러를 캐치해 조용히 degrade하므로, 에러 메시지만으로는
 * 빌드 로그에 어떤 서비스가 실제로 차단됐는지 드러나지 않는다. 이 헬퍼가 그
 * 가시성을 담당한다.
 */
export function warnOfflineBuildOnce(service: string): void {
    if (warnedServices.has(service)) return;
    warnedServices.add(service);
    console.warn(`[offline-build] blocking ${service} request`);
}

/** @internal 테스트 간 `warnOfflineBuildOnce`의 프로세스 메모를 초기화한다. */
export function __resetOfflineBuildWarningsForTests(): void {
    warnedServices.clear();
}
