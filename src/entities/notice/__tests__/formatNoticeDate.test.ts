import { formatNoticeDate } from '@/entities/notice/lib/formatNoticeDate';

/**
 * 문장 조립은 `NoticePopup`이 `shared.ui.misc.noticeWrittenOn`으로 한다 —
 * 예전엔 이 모듈이 `2026.06.03 작성`을 통째로 만들어 `/en`의 공지 팝업이
 * 한국어를 렌더했다. 여기서는 날짜 조각만 검사한다.
 */
describe('formatNoticeDate', () => {
    it('Date 객체 입력에서 연·월·일을 뽑는다', () => {
        expect(formatNoticeDate(new Date(2026, 5, 3))).toEqual({
            year: '2026',
            month: '06',
            day: '03',
        });
    });

    it('ISO 문자열 입력도 같은 조각을 준다', () => {
        expect(formatNoticeDate('2026-06-03T00:00:00')).toEqual({
            year: '2026',
            month: '06',
            day: '03',
        });
    });

    it('파싱할 수 없는 문자열은 null을 반환한다', () => {
        expect(formatNoticeDate('not-a-date')).toBeNull();
    });

    it('월·일이 한 자리일 때 0을 앞에 붙인다', () => {
        expect(formatNoticeDate(new Date(2026, 0, 5))).toEqual({
            year: '2026',
            month: '01',
            day: '05',
        });
    });
});
