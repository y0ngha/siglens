/**
 * 수급 탭 섹션 제목의 앵커 id.
 */
import { FLOWS_DILUTION_SECTION_ID } from '@/entities/investor-flows/lib/flowsAnchors';

/**
 * 증자·희석 섹션 제목의 id. 차트 화면 희석 배지가 이 제목으로 점프하므로 엔티티가 정한 값을 그대로 쓴다 — 위젯 `.tsx`가 엔티티
 * lib를 직접 import하지 않도록 이 util을 거친다.
 */
export const DILUTION_HEADING_ID = FLOWS_DILUTION_SECTION_ID;
