import { GET_MY_WATCHLIST_TOOL } from '@/features/agent-tools/spec/watchlistAlertTools';

/**
 * 게스트가 쓸 수 없는 도구: 자기 보유 종목과 관심종목 — 계정이 없으면 담아 둔 것이 없다(비회원의 관심종목은
 * siglens.io 브라우저의 localStorage에만 있어 ai 호스트가 읽을 수 없다). 새 분석과 웹 검색, 가격대 알림 제안은
 * 게스트에게도 열려 있고 코어의 턴당 상한이 묶는다(알림은 사용자의 버튼과 이메일 코드로만 만들어진다).
 *
 * 여기 이름은 모두 개인정보처리방침의 AI 대화 조항이 말하는 "답변 생성을 위해 모델에 전송되는 회원 정보"와 짝이다 —
 * 새 이름을 더하면 `agentPersonalDataPrivacy.test.ts`가 방침의 네 곳(수집 조항·보유 기간·DeepSeek·Google 이전 항목)에
 * 그 문구가 있는지 본다. 가벼운 모듈에 둔 이유: 그 가드가 모든 실행기를 끌어오는 `chatTools`를 import하지 않게.
 */
export const MEMBER_ONLY_TOOLS: ReadonlySet<string> = new Set([
    'get_my_portfolio',
    GET_MY_WATCHLIST_TOOL,
]);
