// buildId(GIT_SHA)는 배포 격리용 S3 prefix — 배포마다 prefix가 갈려 옛 캐시가 자동 무효화된다.
export const config = {
    bucket: process.env.ISR_CACHE_BUCKET,
    region: process.env.AWS_REGION || 'ap-northeast-2',
    keyPrefix: 'siglens-isr',
    buildId: process.env.GIT_SHA || 'dev',
    disabled: process.env.ISR_CACHE_DISABLED === 'true',
    // `next build`(prerender) 중에는 S3를 건드리지 않는다. 빌드는 EC2 instance
    // role이 없는 도커 빌더에서 돌아 모든 GET/PUT이 CredentialsProviderError로
    // 실패하고(fail-open이라 빌드는 통과) 배포 로그를 수십 줄 채우면서 SDK 재시도
    // 대기만 더한다. 빌드 산출물은 Next가 직접 `.next`에 쓰므로 잃는 것이 없다.
    // Next가 빌드 시작 시 설정한다(next/dist/build/index.js: NEXT_PHASE=phase-production-build).
    buildPhase: process.env.NEXT_PHASE === 'phase-production-build',
};
