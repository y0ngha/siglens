// src/views/share barrel — 공유 페이지 컴포지션 레이어 공개 API.
// ShareKindPanel: RSC 경계 디스패처 (서버 → 클라이언트 직렬화).
// kindPanelRegistry: 각 ShareableKind → 읽기 전용 패널 매핑.
// 두 모듈 모두 다수의 분석 위젯을 조합하므로 views 레이어가 적합한 위치.

export { ShareKindPanel } from './ShareKindPanel';
