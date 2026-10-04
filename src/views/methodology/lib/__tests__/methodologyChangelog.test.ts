import { METHODOLOGY_UPDATED_AT } from '@/shared/lib/legal';
import { METHODOLOGY_CHANGELOG } from '../methodologyChangelog';

/** `YYYY-MM-DD`, 한국 날짜 — 변경 이력 표가 쓰는 형식과 같다. */
function kstDate(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/**
 * 이력에 새 항목을 넣으면서 `METHODOLOGY_UPDATED_AT`을 안 올리면 화면의 "마지막
 * 업데이트"·JSON-LD `dateModified`·sitemap `lastmod`가 옛 날짜로 남는다. 둘은 사람이
 * 함께 올리는 값이라 여기서 묶는다.
 */
describe('METHODOLOGY_CHANGELOG', () => {
    it('최신 항목의 날짜가 METHODOLOGY_UPDATED_AT(한국 날짜)과 같다', () => {
        expect(METHODOLOGY_CHANGELOG[0]?.date).toBe(
            kstDate(METHODOLOGY_UPDATED_AT)
        );
    });

    it('최신순으로 정렬돼 있다', () => {
        const dates = METHODOLOGY_CHANGELOG.map(entry => entry.date);
        expect(dates).toEqual(dates.toSorted().toReversed());
    });
});
