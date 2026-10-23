/**
 * 정본 라우트. 메인 사본과의 대조(같은 props, 같은 Dataset)는 사본 쪽 스위트가 맡고, 여기서는
 * 게이트·정본 메타데이터·메시지 래퍼만 본다.
 */
const state = vi.hoisted(() => ({ release: null as unknown }));

vi.mock('@/entities/benchmark/release', () => ({
    getPublishedBenchmarkRelease: () => state.release,
}));
vi.mock('@/views/benchmark/BenchmarkPage', () => ({
    BenchmarkPage: () => null,
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import AiBenchmarkRoute, {
    generateMetadata,
} from '@/app/ai/[locale]/benchmark/page';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { RouteMessages } from '@/shared/i18n/RouteMessages';

const params = (locale = 'ko') => ({ params: Promise.resolve({ locale }) });

function findByType(
    node: ReactNode,
    type: unknown
): ReactElement<{ route?: string; locale?: string }> | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByType(child, type);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (!isValidElement(node)) return undefined;
    if (node.type === type) {
        return node as ReactElement<{ route?: string; locale?: string }>;
    }
    return findByType((node.props as { children?: ReactNode }).children, type);
}

describe('ai.siglens.io/benchmark route', () => {
    beforeEach(() => {
        state.release = null;
    });

    describe('while the gate is shut', () => {
        it('404s the page', async () => {
            await expect(AiBenchmarkRoute(params())).rejects.toThrow(
                'NEXT_NOT_FOUND'
            );
        });

        it('404s the metadata', async () => {
            await expect(generateMetadata(params())).rejects.toThrow(
                'NEXT_NOT_FOUND'
            );
        });
    });

    describe('once published', () => {
        beforeEach(() => {
            state.release = BENCHMARK_FIXTURE;
        });

        it('is the canonical copy with the ai host canonical and og:url', async () => {
            const metadata = await generateMetadata(params());
            expect(metadata.alternates?.canonical).toBe(
                `${AI_SITE_URL}/benchmark`
            );
            expect(metadata.openGraph).toMatchObject({
                url: `${AI_SITE_URL}/benchmark`,
            });
            expect(metadata.robots).toMatchObject({ index: true });
        });

        it('does not export a revalidate — the ai layout is force-dynamic', async () => {
            const routeModule =
                await import('@/app/ai/[locale]/benchmark/page');
            expect('revalidate' in routeModule).toBe(false);
        });

        it('wraps the body in the benchmark route messages for the locale', async () => {
            const wrapper = findByType(
                await AiBenchmarkRoute(params('en')),
                RouteMessages
            );
            expect(wrapper?.props).toMatchObject({
                route: 'benchmark',
                locale: 'en',
            });
        });
    });
});
