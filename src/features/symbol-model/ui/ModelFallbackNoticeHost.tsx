'use client';

import { useEffect, useEffectEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ModelId } from '@y0ngha/siglens-core';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { subscribeAnalysisModelFallback } from '@/shared/lib/sse/analysisModelFallback';
import { useToast } from '@/shared/ui/ToastProvider';
import { claimFallbackNotice } from '../lib/fallbackNoticeSession';
import { readStoredModel } from '../lib/storedAnalysisModel';
import { useSymbolModel } from '../model/SymbolModelContext';

/**
 * 고른 모델이 일시 중단돼 기본 모델로 분석한다는 안내(토스트) 하나를 맡는다.
 *
 * 두 경로에서 뜬다.
 * - 클라이언트 강등: 저장된 선택(localStorage)이 꺼진 서버 키 모델이라 `SymbolModelProvider`가
 *   기본 모델로 떨어뜨렸다. 저장값은 그대로 두므로(다시 켜면 복원) 저장값으로 판정한다.
 * - 서버 대체: 목록을 받기 전이거나 오래 열어 둔 탭에서 꺼진 모델로 분석을 보냈고, 서버가
 *   기본 모델로 바꿔 돌렸다(`runAnalysisStream`이 신호를 발행). 꺼진 목록이 낡았다는
 *   뜻이므로 다시 받아 화면 선택도 강등되게 한다.
 */
export function ModelFallbackNoticeHost() {
    const t = useTranslations('features.symbol-model');
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { unavailableModels, fallbackModel, isHydrated } = useSymbolModel();

    const notify = useEffectEvent((from: ModelId, to: ModelId) => {
        if (!claimFallbackNotice()) return;
        showToast({
            message: t('fallbackTitle', { model: getModelDisplay(from).label }),
            detail: t('fallbackDetail', {
                fallback: getModelDisplay(to).label,
            }),
        });
    });

    const refreshDisabledModels = useEffectEvent(() => {
        void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.disabledServerKeyModels(),
        });
    });

    useEffect(
        () =>
            subscribeAnalysisModelFallback(fallback => {
                notify(fallback.from, fallback.to);
                refreshDisabledModels();
            }),
        []
    );

    useEffect(() => {
        if (!isHydrated || unavailableModels.length === 0) return;
        const stored = readStoredModel();
        // 강등 대상은 컨텍스트가 `useSelectedModel`과 같은 규칙으로 구한 `fallbackModel`이다.
        // `modelId`는 이 effect 시점에 아직 강등 전 값일 수 있어 쓰지 않는다.
        if (stored !== null && unavailableModels.includes(stored)) {
            notify(stored, fallbackModel);
        }
    }, [isHydrated, unavailableModels, fallbackModel]);

    return null;
}
