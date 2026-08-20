'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { StreamErrorMessages } from './useAnalysisStream';

/**
 * `runAnalysisStream`이 throw할 실패 문구를 로케일에 맞게 만든다.
 *
 * `runAnalysisStream`은 훅이 아니라 평범한 async 함수라 스스로 번역할 수 없는데,
 * 거기서 throw한 메시지는 `<ErrorBanner>`에 그대로 렌더된다. 서버 쪽 SSE 문구만
 * 카탈로그로 옮기면 같은 배너가 경로에 따라 반쪽만 번역되므로, 호출하는 훅이
 * 이걸로 문구를 만들어 넘긴다.
 */
export function useStreamErrorMessages(): StreamErrorMessages {
    const t = useTranslations('app.api.stream');
    return useMemo(
        () => ({
            busy: t('busy'),
            failed: (status: number) => t('failed', { v0: status }),
            disconnected: t('disconnected'),
            unreadable: t('unreadable'),
            generic: t('generic'),
            unexpected: t('unexpected'),
            unstable: t('unstable'),
            keyRequired: t('keyRequired'),
            limitExceeded: t('limitExceeded'),
            noNews: t('noNews'),
            noOptionsChains: t('noOptionsChains'),
            analysisFailed: t('analysisFailed'),
            fetchFailed: t('fetchFailed'),
        }),
        [t]
    );
}
