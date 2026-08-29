import { expect, vi } from 'vitest';
import { buildBreadcrumbJsonLd, type BreadcrumbItem } from '@/shared/lib/seo';

/**
 * 종목 탭 BreadcrumbList의 두 번째 마디(홈 다음)가 화면 브레드크럼과 같은
 * `displayName`인지 확인한다.
 *
 * 9개 탭이 전부 티커(`AAPL`)를 넣고 있었는데 화면 브레드크럼
 * (`views/symbol/SymbolLayoutHeader`)은 `애플, Apple Inc. (AAPL)`을 그린다.
 * 구글은 마크업과 화면 텍스트가 다르면 breadcrumb 리치 결과에서 마크업을 무시한다.
 *
 * `buildBreadcrumbJsonLd`를 `vi.fn()`으로 목킹한 테스트 파일에서만 쓸 수 있다 —
 * 목킹하지 않은 파일은 렌더된 JSON-LD를 직접 읽으면 된다.
 */
export function expectSymbolBreadcrumbName(expected: string): void {
    const calls = vi.mocked(buildBreadcrumbJsonLd).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const trail = calls[0][0] as readonly BreadcrumbItem[];
    expect(trail[0]).toMatchObject({ name: expected });
}
