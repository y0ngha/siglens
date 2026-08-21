import type { StreamErrorMessages } from '@/shared/hooks/useAnalysisStream';

/**
 * 테스트용 `StreamErrorMessages`.
 *
 * 픽스처를 파일마다 인라인으로 두면, 번들에 필드를 하나 추가할 때마다 세 곳을
 * 손으로 고쳐야 한다 — 그 과정에서 한 곳만 빠뜨리면 그 스위트만 조용히 낡는다.
 * 값은 필드명 그대로라 단언이 무엇을 보고 있는지 읽힌다.
 */
export const TEST_STREAM_MESSAGES: StreamErrorMessages = {
    busy: 'busy',
    failed: (status: number) => `failed ${status}`,
    disconnected: 'disconnected',
    unreadable: 'unreadable',
    generic: 'generic',
    unexpected: 'unexpected',
    unstable: 'unstable',
    keyRequired: 'keyRequired',
    limitExceeded: 'limitExceeded',
    noNews: 'noNews',
    noOptionsChains: 'noOptionsChains',
    analysisFailed: 'analysisFailed',
    fetchFailed: 'fetchFailed',
    congressFetchFailed: 'congressFetchFailed',
    digestUnavailable: 'digestUnavailable',
    reanalyzeCooldown: (seconds: number) => `reanalyzeCooldown ${seconds}`,
};
