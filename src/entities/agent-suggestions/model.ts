import type { Locale } from '@/shared/i18n/locales';

/** `getAgentSuggestions` 입력 — ai.siglens.io 빈 화면의 AI 생성 추천 질문을 만들기 위한 요청 정보. */
export interface AgentSuggestionsInput {
    /** 생성할 질문의 출력 언어이자 캐시 키·헤드라인 조회의 로케일. */
    readonly locale: Locale;
    /** 로그인 사용자 id — 회원에게만 호출된다(비회원은 정적 질문으로 대체). 포트폴리오가 있을 때만 캐시 키에 들어간다. */
    readonly userId: string;
    /** 현재 보유 종목. 비어 있지 않으면 질문 중 2개가 이 종목을 겨냥한다(core `buildSuggestionsPrompt`). */
    readonly portfolioSymbols: readonly string[];
}
