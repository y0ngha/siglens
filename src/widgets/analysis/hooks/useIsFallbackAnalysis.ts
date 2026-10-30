'use client';

/**
 * 응답이 서사 없는 폴백 placeholder(`buildFallbackAnalysis`)인지 판정하는 훅.
 */
import { useTranslations } from 'next-intl';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { isFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';

/**
 * 폴백 응답이면 `true`. 판정 sentinel은 `buildFallbackAnalysis`와 같은 번역 문구여야
 * 하므로 훅이 번역자를 읽어 entity 판정 함수에 넘긴다 — UI 파일이 entity `lib/`를
 * 직접 부르지 않도록 이 훅이 연결점이 된다.
 *
 * 폴백 응답의 trend·summary는 `normalizeAnalysisResponse`가 채워 넣은 fabricated
 * 값이라, 호출부는 이 값으로 추세 배지·요약·개인화 배지를 숨긴다.
 */
export function useIsFallbackAnalysis(analysis: AnalysisResponse): boolean {
    const tFallback = useTranslations('entities.analysis.fallback');
    return isFallbackAnalysis(analysis, tFallback('unavailable'));
}
