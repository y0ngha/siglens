import type { CallAiProviderOptions } from '@y0ngha/siglens-core';

/**
 * 키 결정이 끝난 뒤 구체 provider 어댑터에 넘기는 옵션.
 *
 * siglens-core의 `CallAiProviderOptions`는 서로 배타적인 키 필드 **둘**(BYOK는 `userApiKey`,
 * 서버 과금 호출은 `serverApiKey`)을 싣고 선택을 어댑터에 맡긴다. 어댑터가 그 선택을 하면 안 된다:
 * 어댑터 하나가 틀린 필드를 읽으면 조용히 엉뚱한 쪽에 과금된다 — SDK는 `undefined`를 받으면
 * `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` env로 폴백하므로 BYOK 호출이 서버의 분석용 키를 쓰게 된다.
 *
 * `callAiProviderRouter`가 쌍을 이 단일 non-optional `apiKey`로 한 번 접으므로
 * 어댑터에는 잘못 읽을 필드가 남지 않는다.
 */
export interface ProviderCallOptions extends Omit<
    CallAiProviderOptions,
    'userApiKey' | 'serverApiKey'
> {
    /** 이 호출의 유효 키 — BYOK 키가 있으면 그것, 없으면 서버 키. 로그·응답에 싣지 않는다. */
    apiKey: string;
    /**
     * `[Usage]` 텔레메트리에서 호출 표면을 가리키는 라벨. 생략하면 `CHAT_JOB_ID`로,
     * 라우터로 보낸 챗 호출이 원하는 값이다. 어댑터를 직접 부르는 호출자(예: 한국어 번역기)는
     * 자기 라벨을 넘긴다.
     */
    jobId?: string;
    /** 호출별 상한(선택). 생략하면 각 어댑터의 기존 기본값을 따른다. */
    limits?: ProviderCallLimits;
}

/**
 * 출력이 짧다는 것을 알고, 멈춘 호출이 반복 과금되면 안 되는 호출자를 위한 호출별 상한.
 *
 * 이게 없으면 어댑터는 모델 스펙의 `maxOutputTokens`(DeepSeek은 393,216)와 SDK 전송 기본값
 * (OpenAI/Anthropic: 10분 timeout × 3회 시도)로 돌아간다. 답이 길고 스트림에 자체 abort가 있는
 * 챗봇에는 맞지만, 한 문단짜리 재작성이 멈추면 호출자가 이미 포기한 뒤에도 백그라운드에서
 * 최대 세 번 과금될 수 있다.
 *
 * 모든 필드는 선택이고 서로 독립이다 — 생략한 필드는 어댑터의 기존 동작을 유지하므로
 * 기존 호출자는 바뀌지 않는다.
 */
export interface ProviderCallLimits {
    /** 출력 토큰 상한. 스펙 자체의 최대값으로 잘리며 그 위로 올라가지 않는다. */
    readonly maxOutputTokens?: number;
    /**
     * 응답 본문까지 포함한 호출 전체 마감(ms). 모든 어댑터가 `createCallDeadline`으로 지킨다:
     * 만료되면 요청을 abort하고 `ProviderCallTimeoutError`로 거절한다. SDK 자체 `timeout`은
     * 응답 헤더까지만 덮는다.
     */
    readonly timeoutMs?: number;
    /** 첫 시도 이후 SDK 수준 재시도 횟수. `0`이면 재시도하지 않는다. */
    readonly maxRetries?: number;
}
