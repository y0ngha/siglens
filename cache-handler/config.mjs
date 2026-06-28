// buildId(GIT_SHA)는 배포 격리용 S3 prefix — 배포마다 prefix가 갈려 옛 캐시가 자동 무효화된다.
export const config = {
    bucket: process.env.ISR_CACHE_BUCKET,
    region: process.env.AWS_REGION || 'ap-northeast-2',
    keyPrefix: 'siglens-isr',
    buildId: process.env.GIT_SHA || 'dev',
    disabled: process.env.ISR_CACHE_DISABLED === 'true',
};
