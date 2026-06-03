import { matchPath } from '@/entities/notice/lib/matchPath';

describe('matchPath', () => {
    describe('전역 패턴', () => {
        it('pattern이 null이면 모든 경로에 매칭된다', () => {
            expect(matchPath(null, '/')).toBe(true);
            expect(matchPath(null, '/symbol/AAPL')).toBe(true);
        });

        it("pattern이 '/*'이면 모든 경로에 매칭된다", () => {
            expect(matchPath('/*', '/')).toBe(true);
            expect(matchPath('/*', '/market')).toBe(true);
        });
    });

    describe('정확 일치', () => {
        it('동일 경로에만 매칭된다', () => {
            expect(matchPath('/about', '/about')).toBe(true);
            expect(matchPath('/about', '/about/team')).toBe(false);
            expect(matchPath('/about', '/')).toBe(false);
        });

        it('trailing slash는 정규화되어 매칭된다', () => {
            expect(matchPath('/about', '/about/')).toBe(true);
        });
    });

    describe('접두 와일드카드', () => {
        it('접두 경로와 그 하위 경로에 매칭된다', () => {
            expect(matchPath('/symbol/*', '/symbol')).toBe(true);
            expect(matchPath('/symbol/*', '/symbol/AAPL')).toBe(true);
            expect(matchPath('/symbol/*', '/symbol/AAPL/news')).toBe(true);
        });

        it('trailing slash가 붙은 접두 경로에도 매칭된다', () => {
            expect(matchPath('/symbol/*', '/symbol/')).toBe(true);
        });

        it('접두가 부분 문자열로만 겹치는 경로에는 매칭되지 않는다', () => {
            expect(matchPath('/symbol/*', '/symbolize')).toBe(false);
            expect(matchPath('/symbol/*', '/market')).toBe(false);
        });
    });

    describe('worst case', () => {
        it('빈 문자열 pattern은 빈 경로에만 매칭된다', () => {
            expect(matchPath('', '')).toBe(true);
            expect(matchPath('', '/')).toBe(false);
        });
    });
});
