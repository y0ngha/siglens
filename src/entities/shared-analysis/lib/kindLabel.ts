import type { ShareableKind } from '../types';

/**
 * ShareableKind를 한국어 레이블로 변환한다.
 *
 * 공유 페이지 헤더의 "종류 칩"과 OG 이미지 레이블에 사용된다.
 * 새 kind가 추가되면 satisfies 제약으로 컴파일 에러가 발생하므로
 * 추가 즉시 여기에 항목을 등록해야 한다.
 */
const KIND_LABEL_MAP = {
    chart: '차트 분석',
    overall: '종합 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    financials: '재무 분석',
    congress: '의회 거래 분석',
    options: '옵션 분석',
    'fear-greed': '공포·탐욕 지수',
} as const satisfies Record<ShareableKind, string>;

export function kindLabel(kind: ShareableKind): string {
    return KIND_LABEL_MAP[kind];
}
