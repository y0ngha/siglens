import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    AUTH_REQUIRED_PATHS,
    GUEST_ONLY_PATHS,
    predictGuardedLanding,
} from '@/shared/config/authGuardPaths';

describe('predictGuardedLanding', () => {
    describe('힌트 쿠키가 없을 때(게스트로 추정)', () => {
        it.each(['/portfolio', '/account', '/account/delete'])(
            '%s는 로그인 페이지에 도착한다',
            path => {
                expect(predictGuardedLanding(path, false)).toBe('/login');
            }
        );

        it.each(['/login', '/signup', '/market', '/AAPL/news', '/'])(
            '%s는 그대로 도착한다',
            path => {
                expect(predictGuardedLanding(path, false)).toBe(path);
            }
        );
    });

    describe('힌트 쿠키가 있을 때(회원으로 추정)', () => {
        it.each([...GUEST_ONLY_PATHS])('%s는 홈에 도착한다', path => {
            expect(predictGuardedLanding(path, true)).toBe('/');
        });

        it.each(['/portfolio', '/account', '/market', '/AAPL'])(
            '%s는 그대로 도착한다',
            path => {
                expect(predictGuardedLanding(path, true)).toBe(path);
            }
        );
    });

    it('가드 대상 경로 목록이 비어 있지 않다', () => {
        expect(GUEST_ONLY_PATHS.size).toBeGreaterThan(0);
        expect(AUTH_REQUIRED_PATHS.length).toBeGreaterThan(0);
    });

    /**
     * 프록시와 **같은 매칭 방식**이어야 예측이 맞는다: 로그인 필요 경로는 접두 일치,
     * 게스트 전용 경로는 정확 일치다.
     */
    describe('프록시와 같은 매칭 방식', () => {
        it('로그인 필요 경로는 접두 일치다', () => {
            expect(predictGuardedLanding('/portfolio/anything', false)).toBe(
                '/login'
            );
        });

        it('게스트 전용 경로는 정확 일치다 — 하위 경로는 가드 대상이 아니다', () => {
            expect(predictGuardedLanding('/signup/oauth/consent', true)).toBe(
                '/signup/oauth/consent'
            );
        });
    });

    /**
     * 목록을 프록시가 따로 들고 있으면 한쪽만 고쳐져 예측이 조용히 틀어진다. 프록시가
     * 이 파일의 목록을 쓰는지 소스로 고정한다.
     */
    it('프록시는 이 파일의 목록을 쓴다', () => {
        const proxy = readFileSync(
            path.resolve(__dirname, '../../../proxy.ts'),
            'utf8'
        );
        expect(proxy).toContain("from '@/shared/config/authGuardPaths'");
        expect(proxy).not.toMatch(
            /const (GUEST_ONLY_PATHS|AUTH_REQUIRED_PATHS)\b/
        );
    });
});
