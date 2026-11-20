import { ThinkingLevel } from '@google/genai';

/**
 * 카탈로그 번역 요청 본문. 호출부(`translate.mjs`)에서 분리한 이유는 요청 모양을
 * 키·네트워크 없이 단위 테스트하기 위해서다 — 스크립트 본문은 import만 해도 실행된다.
 *
 * 모델: 2026-11-21(KST)에 읽은 Google 문서 기준으로 `gemini-2.5-flash`는 2026-12-01에
 * `gemini-3.5-flash-lite`로 자동 라우팅되며 "`thinking_level`이 `thinking_budget`을
 * 대체하고 샘플링 파라미터가 제거된다"고 적혀 있다(실측 아님). 라우팅에 맡기지 않고
 * 도착지 id를 직접 쓴다.
 *
 * 추론: 이 모델의 기본 사고 수준은 MINIMAL이다(같은 문서). 번역은 결정적 변환이라
 * 추론 이득이 없으므로 명시해서 고정한다. 3세대 이후는 `thinkingBudget`이 아니라
 * `thinkingLevel`을 쓴다.
 *
 * `temperature`는 보내지 않는다. 같은 변경 로그가 자동 라우팅 대상에서 샘플링
 * 파라미터가 제거된다고 적고 있어서다. 이 id가 `temperature: 0`을 받았을 때 어떻게
 * 동작하는지는 문서로도 실측으로도 확인하지 않았으므로, 이전처럼 결정적 출력이
 * 유지되는지는 알 수 없다. 응답 형식(`responseMimeType`)은 그대로다.
 *
 * 같은 요청을 `db/scripts/lib/translateRequest.ts`도 만든다(실행 환경이 달라 따로
 * 둔다). 모델이나 설정을 바꿀 때는 두 파일을 함께 고친다 — 테스트가 두 요청이 같다는
 * 것을 고정한다. 앱 런타임의 `DEFAULT_TRANSLATE_MODEL`
 * (`src/entities/ticker/server/config.ts`)과는 별개의 값이다.
 */
export function buildTranslateRequest(prompt) {
    return {
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
    };
}
