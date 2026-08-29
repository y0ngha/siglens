import type { ShareableKind } from '@/entities/shared-analysis';

/**
 * ShareableKind를 **메시지 키**로 변환한다(`shared.enumLabel` 기준 상대 경로).
 *
 * 공유 페이지 헤더의 "종류 칩"과 OG 이미지 레이블에 사용된다. 예전에는 한국어
 * 문자열을 돌려줘서 네 로케일 전부 한국어로 나갔다 — 표시는 호출부에서 한다.
 * 새 kind가 추가되면 satisfies 제약으로 컴파일 에러가 발생하므로
 * 추가 즉시 여기에 항목을 등록해야 한다.
 */
const KIND_LABEL_MAP = {
    chart: 'shareKind.chart',
    overall: 'shareKind.overall',
    news: 'shareKind.news',
    fundamental: 'shareKind.fundamental',
    financials: 'shareKind.financials',
    congress: 'shareKind.congress',
    options: 'shareKind.options',
    'fear-greed': 'shareKind.fear-greed',
} as const satisfies Record<ShareableKind, string>;

export function kindLabelKey(kind: ShareableKind): string {
    return KIND_LABEL_MAP[kind];
}
