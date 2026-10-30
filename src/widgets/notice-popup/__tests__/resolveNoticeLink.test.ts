import { resolveNoticeLink } from '../utils/resolveNoticeLink';

describe('resolveNoticeLink', () => {
    it('URL이 없으면 링크를 그리지 않는다', () => {
        expect(resolveNoticeLink(null, '자세히')).toBeNull();
    });

    it('http(s)가 아닌 URL은 링크를 그리지 않는다', () => {
        expect(resolveNoticeLink('javascript:alert(1)', '클릭')).toBeNull();
    });

    it('라벨이 있으면 그 라벨을 쓴다', () => {
        expect(resolveNoticeLink('https://x.io/a', '자세히 보기')).toEqual({
            href: 'https://x.io/a',
            label: '자세히 보기',
        });
    });

    it('라벨이 null이면 URL을 라벨로 쓴다', () => {
        expect(resolveNoticeLink('https://x.io/b', null)).toEqual({
            href: 'https://x.io/b',
            label: 'https://x.io/b',
        });
    });

    it.each(['', '   '])(
        '라벨이 빈 문자열(%j)이면 URL을 라벨로 쓴다 — 이름 없는 빈 버튼을 막는다',
        blank => {
            expect(resolveNoticeLink('https://x.io/c', blank)).toEqual({
                href: 'https://x.io/c',
                label: 'https://x.io/c',
            });
        }
    );

    it('라벨 앞뒤 공백은 걷어낸다', () => {
        expect(resolveNoticeLink('https://x.io/d', '  공지 원문  ')).toEqual({
            href: 'https://x.io/d',
            label: '공지 원문',
        });
    });
});
