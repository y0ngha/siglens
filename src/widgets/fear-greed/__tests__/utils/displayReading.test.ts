import { toDisplayReading } from '../../utils/displayReading';

describe('toDisplayReading', () => {
    it('점수를 반올림한다', () => {
        expect(toDisplayReading(67.6).score).toBe(68);
    });

    it('44.6은 45로 반올림되며 라벨은 중립이다(공포 경계 45 미만이 아니다)', () => {
        expect(toDisplayReading(44.6)).toEqual({
            score: 45,
            label: 'NEUTRAL',
        });
    });

    it('24.6은 25가 되어 극단적 공포가 아니라 공포다', () => {
        expect(toDisplayReading(24.6)).toEqual({ score: 25, label: 'FEAR' });
    });

    it('54.5는 55로 반올림되어 탐욕이다', () => {
        expect(toDisplayReading(54.5)).toEqual({ score: 55, label: 'GREED' });
    });

    it('반올림해도 구간이 같으면 그 구간 라벨이다', () => {
        expect(toDisplayReading(44.4)).toEqual({ score: 44, label: 'FEAR' });
    });

    it('양 끝 점수를 처리한다', () => {
        expect([
            toDisplayReading(0).label,
            toDisplayReading(100).label,
        ]).toEqual(['EXTREME_FEAR', 'EXTREME_GREED']);
    });
});
