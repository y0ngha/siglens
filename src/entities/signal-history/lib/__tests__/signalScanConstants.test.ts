import { SIGNAL_SCAN_RELABEL_CUTOVER } from '../signalScanConstants';

/**
 * 이 상수는 새 기록 코드가 처음 도는 시각 **이하**의 과거여야 한다(그 뒤에 쓴 50/200 행이 20/50 행으로
 * 오인되면 안 된다). 코드 작성·병합일(2026-11-22) 당일의 끝을 넘는 값이면 아직 오지 않은 시각일 수 있다.
 * 테스트 시점의 `Date.now()`와 비교하지 않는 까닭: CI가 나중에 돌면 항상 참이라 아무것도 막지 못한다.
 */
const LATEST_ALLOWED = '2026-11-22T23:59:59.000Z';

describe('SIGNAL_SCAN_RELABEL_CUTOVER', () => {
    it('올바른 ISO 시각이다', () => {
        expect(new Date(SIGNAL_SCAN_RELABEL_CUTOVER).toISOString()).toBe(
            SIGNAL_SCAN_RELABEL_CUTOVER
        );
    });

    it('작성일 끝 이하의 과거로 고정돼 있다 — 새 코드가 쓴 행보다 늦지 않다', () => {
        expect(Date.parse(SIGNAL_SCAN_RELABEL_CUTOVER)).toBeLessThanOrEqual(
            Date.parse(LATEST_ALLOWED)
        );
    });

    it('signal_events 시작(2026-11-15)보다 뒤다 — 오래된 옛 행은 모두 이름 바꾸기 대상이다', () => {
        expect(Date.parse(SIGNAL_SCAN_RELABEL_CUTOVER)).toBeGreaterThan(
            Date.parse('2026-11-15T00:00:00.000Z')
        );
    });
});
