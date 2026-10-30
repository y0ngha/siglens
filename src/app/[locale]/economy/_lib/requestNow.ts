import { cache } from 'react';

/**
 * 이 요청의 "지금"(요청 스코프 `React.cache` 메모).
 *
 * `/economy/kr`은 `generateMetadata`와 본문(`KrEconomyContent`)이 이 값을 함께 읽는다 — 각자
 * `new Date()`를 부르면 ET 자정 경계에서 두 앵커가 갈려, 로더의 `React.cache` 메모(앵커가 키)가
 * DB를 두 번 읽고 metadata가 판정한 degraded(=noindex)와 렌더된 내용이 어긋날 수 있다.
 * `/economy`는 본문(`EconomyContent`)만 읽는다 — 컴포넌트가 렌더 중에 시각을 직접 읽지 않게 하려는 용도다.
 */
export const requestNow = cache((): Date => new Date());
