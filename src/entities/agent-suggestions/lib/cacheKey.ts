import { SUGGESTIONS_PROMPT_VERSION } from '@y0ngha/siglens-core';
import type { AgentSuggestionsInput } from '../model';

/** {@link suggestionsCacheKey} 입력 — 요청 정보에 캐시 대상 시각을 더한 형태. */
export interface SuggestionsCacheKeyInput extends AgentSuggestionsInput {
    /** 키를 만들 기준 시각. 시간 버킷을 `Date.now()`가 아닌 이 값에서 얻어 호출부가 테스트 가능하다. */
    readonly now: Date;
}

/** 한 자리 수를 두 자리로 0 채운다. */
function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 한 시간 분량 추천 질문의 캐시 키.
 *
 * 로케일 현지 시각이 아니라 UTC 시 단위로 버킷팅해, `locale`과 무관하게 고정된
 * 테스트 가능한 시각에 키가 넘어간다. `SUGGESTIONS_PROMPT_VERSION`을 키에 넣어
 * core 프롬프트 문구가 바뀌면 최대 한 시간 동안 낡은 문구를 내보내지 않고 모든
 * 캐시 항목이 무효화된다.
 *
 * `:u:${userId}` 접미사는 포트폴리오 보유 종목이 있을 때만 붙는다 — 포트폴리오가
 * 없는 회원은 같은 로케일·시간대의 다른 회원과 동일한 시장 전반 추천을 받으므로
 * 이 경우 사용자별로 캐시를 쪼갤 이유가 없다.
 */
export function suggestionsCacheKey({
    locale,
    userId,
    portfolioSymbols,
    now,
}: SuggestionsCacheKeyInput): string {
    const hour = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(
        now.getUTCDate()
    )}${pad2(now.getUTCHours())}`;
    const base = `ai:suggest:v1:${SUGGESTIONS_PROMPT_VERSION}:${locale}:${hour}`;
    return portfolioSymbols.length > 0 ? `${base}:u:${userId}` : base;
}
