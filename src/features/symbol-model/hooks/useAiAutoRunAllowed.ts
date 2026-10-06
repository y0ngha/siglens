'use client';

import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { markHumanInteracted } from '@/shared/lib/humanInteractionStore';
import { useSymbolModel } from '../model/SymbolModelContext';

export interface AiAutoRunGate {
    /**
     * AI 분석을 생성까지 자동으로 요청해도 되는지. `false`면 호출부는 캐시만
     * 조회(`cacheOnly`)하고, 미스면 "AI 분석 시작" 대기 상태로 둔다.
     */
    allowed: boolean;
    /** "AI 분석 시작" 버튼 — 입력을 즉시 인정해 대기 중인 분석을 시작시킨다. */
    grant: () => void;
}

/**
 * 색인되지 않는 종목 페이지(큐레이션 밖 종목·비색인 로케일)에서 AI 분석 생성을 첫 신뢰
 * 입력 뒤로 미루는 게이트.
 *
 * 허용 조건(하나라도 참이면 지금과 똑같이 자동 생성):
 * - 큐레이션 종목(`isCuratedSymbol`)**이면서** 종목 페이지를 색인하는 로케일
 *   (`SYMBOL_INDEXABLE_LOCALES`) — 색인되는 페이지라 크롤러가 렌더한 DOM이 곧 검색
 *   본문이다. 여기는 절대 막지 않는다.
 *
 *   로케일까지 보는 이유: 종목 페이지는 `ko`만 색인되고(`evaluateSymbolIndexability`의
 *   로케일 게이트) 프리웜도 `ko`만 굽는다. 큐레이션 종목만 보면 `/en|ja|zh/<큐레이션>`은
 *   noindex인데도 렌더형 크롤러·이탈 방문마다 캐시 미스로 기술 분석과 쉽게보기(평이화)를
 *   생성했다(2026-10 비용 감사 M4). 그 페이지는 롱테일과 같이 첫 신뢰 입력 뒤로 미룬다.
 * - 로그인 회원(tier 확정 후 `free`가 아님).
 * - 이 탭에서 신뢰 입력이 있었음(`useHumanInteracted`).
 *
 * 서버는 User-Agent를 보지 않는다 — 이 게이트는 모든 방문자에게 같다.
 * 배경과 실측은 spec `2026-10-04-longtail-ai-interaction-gate-design.md`.
 */
export function useAiAutoRunAllowed(symbol: string): AiAutoRunGate {
    const { tier, isTierHydrated } = useSymbolModel();
    const interacted = useHumanInteracted();
    const locale = useCurrentLocale();
    const indexedPage =
        isCuratedSymbol(symbol) && SYMBOL_INDEXABLE_LOCALES.includes(locale);
    const allowed =
        indexedPage || (isTierHydrated && tier !== 'free') || interacted;
    return { allowed, grant: markHumanInteracted };
}
