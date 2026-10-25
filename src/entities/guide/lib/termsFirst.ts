import type { GuideCategory } from '../types';

/**
 * 검색 입력 순서에서 질문형 글(`howto`)을 용어 항목 뒤로 보낸다(안정 정렬, 나머지 순서 유지).
 *
 * `searchGuide`는 같은 순위 안에서 입력 순서를 지키는데, 카탈로그는 `howto`가 첫 분류라 그대로
 * 넣으면 접두·부분 일치에서 "골든크로스 매매법"이 "골든크로스"를 밀어낸다. 개념을 찾는 질의에는
 * 용어 항목이 먼저 나와야 하므로 검색 직전에만 이 순서를 쓴다 — 빈 질의의 목록은 카탈로그 순서 그대로다.
 * 완전 일치 순위는 그대로라 "RSI 보는 법"처럼 글 제목을 정확히 치면 howto가 맨 앞에 온다.
 */
export function termsFirst<T extends { readonly category: GuideCategory }>(
    entries: readonly T[]
): T[] {
    return [
        ...entries.filter(entry => entry.category !== 'howto'),
        ...entries.filter(entry => entry.category === 'howto'),
    ];
}
