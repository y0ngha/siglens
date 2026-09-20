# 종목 챗봇 폐지 → SIGLENS AI(ai.siglens.io)로 유도

작성일: 2026-09-20. 사용자 결정: siglens.io 종목 페이지의 자체 챗봇을 없애고 오른쪽 아래 플로팅 버튼을 ai.siglens.io로 보낸다. 세부 판단은 위임받았다.

## 왜

- 같은 일을 하는 챗이 두 벌이다. 종목 챗봇은 하루 5회 토큰 한도에 페이지 문맥만 알고, SIGLENS AI는 도구 호출·출처·대화 저장까지 한다.
- 종목 챗봇 때문에 뉴스·펀더멘털 탭은 스냅샷 본문이 있어도 AI 위젯을 숨긴 채 마운트해 클라이언트 AI 분석을 부른다(`hideView`). 챗 문맥 발행 말고는 이유가 없다.

## 무엇을 바꾸나

1. **플로팅 버튼**: `/[symbol]/*` 오른쪽 아래 버튼은 그대로 두되, 누르면 패널 대신 `aiAskUrl(localePrefix, question)`로 이동한다(새 탭, `rel="noopener"`). 질문은 미리 채워질 뿐 자동 전송되지 않는다(`aiAskUrl` 계약).
   - 라벨: "SIGLENS AI에게 물어보기" (아이콘 + 텍스트 알약, 모바일은 아이콘 + 짧은 라벨)
   - 미리 채울 질문: `{name} 지금 어떤 상황인지 종합적으로 알려줘` — 기존 ChatPanel의 `askSiglensAiQuestion` 문구를 종목명으로.
   - 첫 방문 툴팁(`siglens:chat-tooltip-shown`)은 없앤다.
2. **삭제(챗봇 전용)**: `src/widgets/chat/**`, `src/features/symbol-chat/**`, 8개 탭의 `buildChatState` + `usePublishSymbolChat` 호출, `SymbolChatProvider` 배선, `entities/chat-message`의 `chatAction`·`getRemainingTokensAction`·`localeEnvelope`·`derivePageContextLabel`·`CHAT_NON_CHART_BASELINE_ANALYSIS`·챗 전용 타입, 챗 전용 게스트 IP 카운터, `getOrCreateGuestId`(챗 전용이면), `getLlmProvider`·`FakeChatProvider`(챗 전용이면), 챗 모델 localStorage 키와 `migrateChatModel`, `shared/lib/types`의 `DisplayMessage`·`ContextSwitchMessage`, `widgets.chat.*`·`entities.chat-message.pageContext.*` 번역 키, 관련 테스트·e2e.
3. **옮김**: `isFallbackAnalysis`·`buildFallbackAnalysis`(차트·분석 패널이 쓴다)와 `fallback.unavailable` 문구는 `entities/analysis`로 옮긴다. "이동" = 원본 삭제 + 옛 경로 grep 0.
4. **(리뷰에서 되돌림) 숨은 위젯은 유지**: 처음 계획은 뉴스·펀더멘털 등 5개 탭의 `hideView` 경로를 없애 스냅샷 본문이 있으면 AI 위젯을 아예 마운트하지 않는 것이었다(원래의 XOR). 리뷰에서 이 마운트가 챗 발행뿐 아니라 헤더 공유 버튼의 `useRegisterShareable` 등록도 겸하고 있음이 드러나 되돌렸다 — 위젯을 아예 렌더하지 않으면 완료된 분석이 있는 종목일수록 공유 버튼이 데이터를 못 받는 역전이 생긴다. 그대로 `hideView`로 UI만 끄고 마운트는 유지한다. 이번 변경으로 얻는 AI 호출 절감은 없다.
5. **그대로 둠**: DB enum `usage_action_type.'chatbot'`(지우려면 마이그레이션 필요, 값이 남아도 해가 없다), siglens-core의 챗 함수(core 레포 몫), LLM 서버 키(에이전트·analysis-plain이 쓴다), `readGuestId`·게스트 쿠키(에이전트가 쓴다), `fallbackAnalysis` 로직 자체.
6. **문서**: ARCHITECTURE 폴더 트리, SCOPE·CLAUDE.md의 챗 트리거 문구(종목 챗봇 없음 반영), API.md 챗봇 키 블록, CONVENTIONS의 import 예시, `.claude/product-marketing-context.md`의 챗봇 서술.

## 검증

- 스코프 테스트 + `src/__tests__/guards` + 전체 스위트 1회, tsc, oxlint(경고 수), React Doctor `--scope changed`, i18n verify/lint/extract 무드리프트, 번역 해시(`translate --dry-run` 0).
- e2e: `symbol-chat.spec.ts`를 "플로팅 버튼이 ai 호스트 `?q=`로 연결된다" 스펙으로 대체, `mobile-analysis-sheet`의 챗 단계 제거.
- 로컬 dev: 종목 페이지 버튼 href, 뉴스 탭(스냅샷 있음)에서 헤더 공유 버튼이 정상 동작하는지 확인(위젯은 `hideView`로 계속 마운트되어 있어 AI 분석 요청 자체는 그대로 나간다).
