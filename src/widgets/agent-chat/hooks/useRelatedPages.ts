'use client';

import { useMemo } from 'react';
import type { RelatedSymbolPage } from '@/features/agent-chat/lib/relatedSymbolPages';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { relatedPagesOf } from '../utils/relatedPagesIndex';
import { useSymbolLabels } from './useSymbolLabels';

export interface RelatedPagesResult {
    readonly pagesById: ReadonlyMap<string, RelatedSymbolPage[]>;
    /** 대화 전체에서 한 번에 받은 표시 이름. */
    readonly labels: Readonly<Record<string, string>>;
}

/**
 * 끝난 답변들의 "siglens에서 보기" 링크와 그 표시 이름.
 *
 * 링크 계산(`relatedPagesOf`)은 transcript가 그대로인 렌더(스크롤 버튼·편집 상태 등)에서
 * 통째로 건너뛰고, 스트리밍 프레임에서도 끝난 답변은 메시지별 캐시로 다시 계산하지 않는다.
 * 라벨 쿼리는 그 결과의 심볼 목록에 기대므로 memo와 쿼리를 한 훅에 묶는다 — 컴포넌트의
 * 훅 선언 순서(커스텀 훅 → memo → 파생 값)를 지키면서 의존 순서도 맞추기 위해서다.
 */
export function useRelatedPages(
    messages: readonly AgentUiMessage[]
): RelatedPagesResult {
    const { pagesById, symbols } = useMemo(
        () => relatedPagesOf(messages),
        [messages]
    );
    const labels = useSymbolLabels(symbols);
    return { pagesById, labels };
}
