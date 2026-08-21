import { describe, expect, it } from 'vitest';
import { timeframeLabel } from '@/shared/lib/timeframeLabel';

/**
 * 이 라벨들은 카탈로그가 아니라 `Intl`에서 나온다. 그래서 `i18n:verify`의
 * 한글-잔존 검사가 못 본다 — 여기서 직접 본다.
 */
describe('timeframeLabel', () => {
    const ALL = ['5Min', '15Min', '30Min', '1Hour', '4Hour', '1Day'] as const;

    it('ko 출력이 예전 하드코딩 테이블과 같다', () => {
        // 두 곳에 복제돼 있던 `{'5Min': '5분', …}`을 대체한 것이므로,
        // ko에서 한 글자라도 달라지면 그건 회귀다.
        expect(ALL.map(tf => timeframeLabel(tf, 'ko'))).toEqual([
            '5분',
            '15분',
            '30분',
            '1시간',
            '4시간',
            '1일',
        ]);
    });

    it.each(['en', 'ja', 'zh'] as const)('%s 라벨에 한글이 없다', locale => {
        for (const tf of ALL) {
            expect(timeframeLabel(tf, locale)).not.toMatch(/[가-힣]/);
        }
    });

    it('로케일마다 실제로 다른 문자열을 낸다', () => {
        const perLocale = (['ko', 'en', 'ja', 'zh'] as const).map(l =>
            timeframeLabel('1Hour', l)
        );

        expect(new Set(perLocale).size).toBe(4);
    });

    it('모르는 타임프레임은 원문을 돌려준다', () => {
        // 빈 문자열이면 화면에서 버튼이 사라진다 — 원문이 낫다.
        expect(timeframeLabel('1Week', 'ko')).toBe('1Week');
    });
});
