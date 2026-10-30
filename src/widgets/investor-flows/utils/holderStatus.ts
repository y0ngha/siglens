/**
 * 상위 보유 기관 변동 상태의 표시 규칙 — 배지 색·기호와 필터 순서.
 */
import type { InstitutionalHolderChangeKind } from '@y0ngha/siglens-core';
import type { HolderFilter } from './institutional';

/** 상태 배지 색(`ui-*-text` AA 변형). 들어온 쪽(신규·증가)은 성공, 나간 쪽(감소·청산)은 위험 톤이다. */
export const STATUS_CLASS: Record<InstitutionalHolderChangeKind, string> = {
    new: 'bg-ui-success/10 text-ui-success-text',
    increased: 'bg-ui-success/10 text-ui-success-text',
    decreased: 'bg-ui-danger/10 text-ui-danger-text',
    exited: 'bg-ui-danger/10 text-ui-danger-text',
    unchanged: 'bg-secondary-700 text-secondary-300',
};

/** 색과 별개로 붙는 방향 기호. */
export const STATUS_MARK: Record<InstitutionalHolderChangeKind, string> = {
    new: '+',
    increased: '▲',
    decreased: '▼',
    exited: '✕',
    unchanged: '=',
};

/** 필터 버튼의 표시 순서. */
export const HOLDER_FILTERS: readonly HolderFilter[] = ['all', 'new', 'exited'];
