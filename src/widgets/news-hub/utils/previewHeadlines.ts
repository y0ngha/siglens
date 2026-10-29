/**
 * @file 허브 카드 미리보기 헤드라인의 개수 상한과 표시용 정리.
 *
 * 상한은 데이터 생산자(`app/[locale]/news/_lib/categoryPreviews.ts`)가 읽기 결과를
 * 자르는 데 쓰고, 정리는 카드가 렌더 직전에 한다.
 */

/**
 * 허브 카드에 띄우는 헤드라인 개수 상한. 세 줄이면 카드가 스크롤 없이 들어간다.
 * 생산자가 이 값으로 잘라 넘기므로 숫자는 여기 한 곳에만 둔다.
 */
export const PREVIEW_HEADLINE_LIMIT = 3;

/**
 * 빈 헤드라인을 버리고 같은 헤드라인은 처음 것만 남긴다(입력 순서 유지).
 *
 * 제목 컬럼이 비어 있는 행은 `resolveNewsTitle`이 `''`를 돌려주고, 통신사 기사는
 * 여러 매체에 같은 제목으로 실린다. 그대로 그리면 빈 항목·같은 줄이 반복되고 React
 * key(헤드라인 문자열)가 겹친다. 결과가 비면 카드는 대체 문구로 넘어간다.
 */
export function distinctPreviewHeadlines(
    headlines: readonly string[]
): readonly string[] {
    return [...new Set(headlines.filter(headline => headline.trim() !== ''))];
}
