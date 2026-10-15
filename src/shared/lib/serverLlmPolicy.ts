import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * 이 호출 흐름이 **서버 키 LLM**(회사명 번역 등 사이트가 비용을 내는 Gemini 호출)을 써도 되는가.
 *
 * 공개 API(`/api/v1`)는 서버 비용을 쓰지 않는 것이 원칙이다. 그런데 회사명 번역은 `getAssetInfo`
 * (`resolveMarketProfile`가 거치는 길 포함)와 `searchTicker` 깊숙한 곳에서 일어나고, 그 길은 도구·분석
 * 러너·core 콜백 등 열 곳이 넘는 호출 사슬에서 닿는다. 인자로 한 겹씩 내리면 한 곳만 빠뜨려도 새므로,
 * 공개 API 실행기가 `runWithoutServerLlm`으로 흐름 전체를 한 번 감싸고 서버 키 LLM이 일어나는 지점이
 * `isServerLlmAllowed()`로 확인한다. 웹·에이전트는 감싸지 않으므로 기본값(허용)이 그대로다.
 *
 * 분기는 호출 지점에서 **동기로** 읽는다 — 감싼 흐름이 띄운 백그라운드 작업도 컨텍스트를 물려받는다.
 */
const policy = new AsyncLocalStorage<{ readonly serverLlm: false }>();

/** `fn`이 시작하는 모든 비동기 흐름에서 서버 키 LLM 호출을 막는다. */
export function runWithoutServerLlm<T>(fn: () => T): T {
    return policy.run({ serverLlm: false }, fn);
}

export function isServerLlmAllowed(): boolean {
    return policy.getStore()?.serverLlm !== false;
}
