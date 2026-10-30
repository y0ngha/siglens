/**
 * 시장 요약 패널의 제목·섹터 그룹 라벨을 메시지 키로 잇는 표.
 */
import {
    KR_CYCLICAL_DEFENSIVE_GROUP_LABEL,
    KR_GROWTH_TECH_GROUP_LABEL,
} from '@/shared/config/dashboard-tickers-kr';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * 섹션 제목 겸 랜드마크 라벨의 메시지 키. 지역 탭이 위에 있어도 제목이 "어느 시장인지"를
 * 한 번 더 말해야 한다 — 스크린리더는 탭의 활성 상태를 이 섹션과 함께 읽지 않는다.
 */
const PANEL_HEADING_KEY: Partial<Record<DashboardScopeId, string>> = {
    us: 'panelHeading.us',
    kr: 'panelHeading.kr',
};

/**
 * 섹터 그룹 라벨 → 메시지 키.
 *
 * `SectorGroupDef.label`은 `@y0ngha/siglens-core` 타입의 필드라 모양을 바꿀 수 없다.
 * 라벨은 siglens config(`dashboard-tickers*.ts`)가 정하므로 이 표만 맞춰 두는 어댑터다.
 */
const SECTOR_GROUP_LABEL_KEY: Readonly<Record<string, string>> = {
    성장: 'sectorGroup.growth',
    경기민감: 'sectorGroup.cyclical',
    방어: 'sectorGroup.defensive',
    [KR_GROWTH_TECH_GROUP_LABEL]: 'sectorGroup.growthTech',
    [KR_CYCLICAL_DEFENSIVE_GROUP_LABEL]: 'sectorGroup.cyclicalDefensive',
};

/**
 * 패널 제목 키. 이 패널을 쓰는 화면이 없는 scope(`crypto`)는 `undefined`라
 * 호출부가 scope 자신의 라벨로 떨어뜨린다 — 키를 억지로 채우면 미국 제목이 붙는다.
 */
export function panelHeadingKey(scopeId: DashboardScopeId): string | undefined {
    return PANEL_HEADING_KEY[scopeId];
}

/** 섹터 그룹 라벨 키. 표에 없는 라벨은 `undefined`라 호출부가 원문을 그대로 쓴다. */
export function sectorGroupLabelKey(label: string): string | undefined {
    return SECTOR_GROUP_LABEL_KEY[label];
}
