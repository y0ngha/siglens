import { todayKstIsoDate } from '@/shared/lib/dateKey';

describe('todayKstIsoDate 함수는', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("UTC 자정의 시각을 KST 기준 같은 날짜('YYYY-MM-DD')로 반환한다", () => {
        // 2026-05-03 00:00:00 UTC → KST 09:00 → 2026-05-03
        vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 4, 3, 0, 0, 0));

        expect(todayKstIsoDate()).toBe('2026-05-03');
    });

    it('UTC 늦은 밤(15:00 이후)이면 KST 기준 다음 날짜를 반환한다', () => {
        // 2026-05-03 16:00 UTC → KST 다음날 01:00 → 2026-05-04
        vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 4, 3, 16, 0, 0));

        expect(todayKstIsoDate()).toBe('2026-05-04');
    });

    it('UTC 이른 새벽(09:00 이전)이면 KST 기준 같은 날짜를 반환한다', () => {
        // 2026-05-03 02:00 UTC → KST 11:00 → 2026-05-03
        vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 4, 3, 2, 0, 0));

        expect(todayKstIsoDate()).toBe('2026-05-03');
    });
});
