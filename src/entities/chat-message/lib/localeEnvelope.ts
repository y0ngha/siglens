import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * 모델에게 답변 언어를 지시하는 표기.
 *
 * 영어 지시문 + 목표 언어의 자기 이름을 함께 준다 — 지시는 영어가 가장 잘 먹고,
 * 자기 이름(`日本語`)은 목표 언어의 토큰을 프롬프트에 넣어 모델이 그 언어로
 * 이어가게 만드는 앵커 역할을 한다.
 */
const LOCALE_DIRECTIVE: Record<Exclude<Locale, 'ko'>, string> = {
    en: 'English',
    ja: 'Japanese (日本語)',
    zh: 'Simplified Chinese (简体中文)',
};

/**
 * 챗 사용자 메시지에 답변 언어 힌트를 덧붙인다.
 *
 * ## 왜 프롬프트가 아니라 메시지 봉투인가
 *
 * `buildChatPrompt`는 `@y0ngha/siglens-core` 소유이고 system prompt에
 * `"Explain everything in plain, friendly Korean"`이 박혀 있다. 그걸 고치려면
 * 교차 레포 PR + 릴리스가 필요하다. 반면 **사용자 메시지 본문은 호출자인
 * siglens의 것**이므로 여기에 지시를 실으면 스코프 경계를 넘지 않는다
 * (`docs/architecture/SCOPE.md` Step 6).
 *
 * 실효가 있는 이유: LLM은 대화의 마지막 사용자 발화 언어를 따라가는 성질이
 * 강하고, system prompt보다 최근 메시지가 가깝다.
 *
 * ⚠️ **한계**: core가 하드코딩한 거절 문구
 * (`'이 분석 결과와 관련된 질문만 답변할 수 있어요.'`)는 모델을 거치지 않고
 * 그대로 반환되므로 이 봉투로 바뀌지 않는다. 그건 core 작업이다.
 *
 * 기본 로케일이면 원문 그대로 — core가 이미 한국어를 요구한다.
 */
export function withLocaleDirective(
    userMessage: string,
    locale: Locale
): string {
    if (locale === DEFAULT_LOCALE) return userMessage;
    const directive = LOCALE_DIRECTIVE[locale];
    return `${userMessage}\n\n[Answer in ${directive}. Do not answer in Korean.]`;
}
