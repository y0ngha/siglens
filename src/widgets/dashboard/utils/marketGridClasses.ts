/**
 * 시장 요약 그리드의 열 구성 클래스. 실제 패널과 스켈레톤이 같은 값을 써야
 * 로딩이 끝나는 순간 카드가 밀리지 않는다.
 */

/** 지수 카드 그리드. */
export const INDEX_GRID_CLASS = 'grid grid-cols-2 gap-2 sm:grid-cols-4';

const SECTOR_GRID_BASE_CLASS = 'grid grid-cols-2 gap-2';
const SECTOR_GRID_DEFAULT_SM_CLASS = 'sm:grid-cols-4';

/**
 * 섹터 개수별 `sm` 이상 열 수. 표에 없는 개수는 4열이다.
 * 모바일은 항상 2열 — 320px에서 3~4열이면 카드가 눌려 가격이 잘린다.
 */
const SECTOR_GRID_SM_CLASS: Readonly<Record<number, string>> = {
    3: 'sm:grid-cols-3',
};

/** 섹터 그룹 하나의 카드 그리드 클래스. */
export function sectorGridClass(sectorCount: number): string {
    const smClass =
        SECTOR_GRID_SM_CLASS[sectorCount] ?? SECTOR_GRID_DEFAULT_SM_CLASS;
    return `${SECTOR_GRID_BASE_CLASS} ${smClass}`;
}
