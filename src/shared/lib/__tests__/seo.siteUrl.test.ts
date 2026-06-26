import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * SITE_URL 프로덕션 가드 테스트.
 *
 * seo.ts는 모듈 로드 시 SITE_URL을 결정하므로
 * 각 케이스마다 vi.resetModules()로 모듈 캐시를 비우고 dynamic import로 재평가한다.
 */
describe('SITE_URL — resolveSiteUrl 프로덕션 가드', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    // NODE_ENV는 TypeScript에서 read-only이지만 런타임에서는 변경 가능하다.
    // 타입 단언으로 테스트 목적의 설정을 허용한다.
    const setNodeEnv = (value: string) => {
        (process.env as Record<string, string>).NODE_ENV = value;
    };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        // 환경 변수 복원
        setNodeEnv(originalNodeEnv);
        if (originalSiteUrl === undefined) {
            delete process.env.NEXT_PUBLIC_SITE_URL;
        } else {
            process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
        }
    });

    it('비프로덕션 환경에서는 잘못된 호스트여도 throw하지 않는다', async () => {
        setNodeEnv('test');
        process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.vercel.app';

        // throw하지 않아야 한다
        const mod = await import('@/shared/lib/seo');
        expect(mod.SITE_URL).toBe('https://preview.vercel.app');
    });

    it('환경 변수가 설정되지 않으면 기본값 https://siglens.io를 사용한다 (비프로덕션)', async () => {
        setNodeEnv('test');
        delete process.env.NEXT_PUBLIC_SITE_URL;

        const mod = await import('@/shared/lib/seo');
        expect(mod.SITE_URL).toBe('https://siglens.io');
    });

    it('프로덕션에서 NEXT_PUBLIC_SITE_URL이 설정되지 않으면 기본값을 사용하며 throw하지 않는다', async () => {
        setNodeEnv('production');
        delete process.env.NEXT_PUBLIC_SITE_URL;

        // throw하지 않아야 한다 (기본값 = siglens.io이므로 검사 대상 아님)
        const mod = await import('@/shared/lib/seo');
        expect(mod.SITE_URL).toBe('https://siglens.io');
    });

    it('프로덕션에서 올바른 siglens.io URL이면 throw하지 않는다', async () => {
        setNodeEnv('production');
        process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.io';

        const mod = await import('@/shared/lib/seo');
        expect(mod.SITE_URL).toBe('https://siglens.io');
    });

    it('프로덕션에서 호스트가 siglens.io가 아니면 throw한다', async () => {
        setNodeEnv('production');
        process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.vercel.app';

        await expect(import('@/shared/lib/seo')).rejects.toThrow(/siglens\.io/);
    });

    it('프로덕션에서 유효하지 않은 URL이면 throw한다', async () => {
        setNodeEnv('production');
        process.env.NEXT_PUBLIC_SITE_URL = 'not-a-url';

        await expect(import('@/shared/lib/seo')).rejects.toThrow(
            /유효한 URL이 아닙니다/
        );
    });
});
