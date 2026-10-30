/**
 * `/methodology` 뷰가 섹션 사이에 주고받는 타입.
 */
import type { getTranslations } from 'next-intl/server';

/**
 * 페이지가 `views.methodology` 네임스페이스로 만든 번역기. 섹션은 비동기 컴포넌트가
 * 아니라 이 번역기를 받는다 — 문자열은 페이지가 한 번 만든 번역기로만 푼다.
 */
export type MethodologyTranslator = Awaited<ReturnType<typeof getTranslations>>;

/** 본문 섹션 하나가 받는 공통 props. 제목은 목차와 같은 값을 쓰도록 페이지가 넘긴다. */
export interface MethodologySectionProps {
    readonly t: MethodologyTranslator;
    readonly title: string;
}
