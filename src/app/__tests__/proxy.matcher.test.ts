import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/middleware', () => ({ default: () => vi.fn() }));

import { INDEXNOW_KEY } from '@/shared/config/indexNow';
import { config } from '../../proxy';

/**
 * 프록시 matcher가 어떤 경로를 **건드리지 않는가**.
 *
 * IndexNow 키 파일(`public/{key}.txt`)은 프록시가 가로채면 안 된다 — 로케일 접두 리다이렉트나
 * 심볼 정규화가 붙으면 검색엔진이 키를 못 읽어 제출이 전부 403이 된다. `.txt`는 matcher의
 * 정적 확장자 제외 목록에 있어 프록시를 아예 타지 않고, 공개 파일은 동적 라우트
 * (`[locale]/[symbol]`)보다 먼저 서빙된다. 이 제외 목록에서 `txt`가 빠지는 순간을 잡는다.
 */
function matchesProxy(pathname: string): boolean {
    // Next의 matcher는 path-to-regexp 문법이지만 이 레포의 패턴은 그룹 안이 정규식이라
    // 앵커만 붙이면 같은 판정이 된다.
    return config.matcher.some(pattern =>
        new RegExp(`^${pattern}$`).test(pathname)
    );
}

describe('proxy matcher', () => {
    it('IndexNow 키 파일은 프록시를 타지 않는다', () => {
        expect(matchesProxy(`/${INDEXNOW_KEY}.txt`)).toBe(false);
    });

    it('종목 페이지는 프록시를 탄다 — 위 판정이 모든 경로를 제외하는 식이 아님을 확인한다', () => {
        expect(matchesProxy('/AAPL')).toBe(true);
        expect(matchesProxy('/AAPL/news')).toBe(true);
    });

    it('robots.txt·sitemap.xml은 명시 항목 때문에 프록시를 탄다', () => {
        expect(matchesProxy('/robots.txt')).toBe(true);
        expect(matchesProxy('/sitemap.xml')).toBe(true);
    });
});
