'use client';

import type { ModelId } from '@y0ngha/siglens-core';
import { useSymbolModel } from '@/components/symbol-page/SymbolModelContext';

/**
 * AI 분석 탭(뉴스, 펀더멘털, 종합)에서 공통으로 사용하는 선택된 AI 모델 ID를 반환한다.
 *
 * 단일 진실값은 SymbolModelContext — 헤더의 ModelSelector가 쓰는 것과 동일한 상태이므로
 * 탭을 이동해도 모델이 일관되게 유지된다.
 */
export function useDefaultModelId(): ModelId {
    const { modelId } = useSymbolModel();
    return modelId;
}
