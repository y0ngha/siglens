/**
 * news-article 엔티티의 타입 정의 — 위젯 훅이 구현 모듈(`lib/`·`actions/`) 대신 여기서 타입을 import한다.
 */
import type { RunNewsAnalysisResult } from '@y0ngha/siglens-core';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** `sentiment`·`priceImpact`가 `null`이면 아직 AI 보강 전이다. */
export interface EnrichableCard {
    sentiment: unknown;
    priceImpact: unknown;
}

/** 목록 폴러의 호출부별 차이. */
export interface CardListPollPolicy {
    /**
     * "전부 보강됨"으로 끝내고 스피너를 끄기 전에 지나야 하는 최소 폴 수. 종목 뉴스는 서버가
     * 뒤에서 새 기사를 받아오는 중일 수 있어 몇 번은 더 확인한다. 마켓 뉴스는 `0`.
     */
    completeMinPolls: number;
    /** 실패도 폴 수로 센다(종목 뉴스) — 실패만 이어지는 빈 목록이 상한까지 끌지 않게. */
    errorsCountAsPolls: boolean;
    /** 5분 상한으로 끝날 때도 완료 알림(`completedItems`)을 보낸다(종목 뉴스). */
    completeOnTimeout: boolean;
}

/** 뉴스 분석 서버 액션의 최종 반환 — core의 뉴스 결과에 siglens 쪽 게이트 오류를 더한 것. */
export type SubmitNewsAnalysisActionResult =
    | RunNewsAnalysisResult
    | AnalysisGateBlockedResult;
