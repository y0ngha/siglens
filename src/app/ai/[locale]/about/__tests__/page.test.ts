/**
 * 뷰는 목으로 바꾼다 — 화면은 `views/ai-about` 스위트가 검사하고, 여기서는 라우트가 넘기는
 * 벤치마크 게이트 값만 본다.
 */
const state = vi.hoisted(() => ({ release: null as unknown }));

vi.mock('@/entities/benchmark/release', () => ({
    getPublishedBenchmarkRelease: () => state.release,
}));
vi.mock('@/views/ai-about/AiAboutPage', () => ({ AiAboutPage: () => null }));

import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiAboutRoute from '@/app/ai/[locale]/about/page';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';

interface ViewProps {
    readonly benchmark?: unknown;
    readonly faq?: unknown;
}

function findViewProps(node: ReactNode): ViewProps | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findViewProps(child);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (!isValidElement(node)) return undefined;
    const props = node.props as ViewProps & { children?: ReactNode };
    if (props.faq !== undefined) return props;
    return findViewProps(props.children);
}

const render = () =>
    AiAboutRoute({ params: Promise.resolve({ locale: 'ko' }) });

describe('ai.siglens.io/about route', () => {
    beforeEach(() => {
        state.release = null;
    });

    it('passes no benchmark while the gate is shut', async () => {
        expect(findViewProps(await render())?.benchmark).toBeNull();
    });

    it('passes the release once published', async () => {
        state.release = BENCHMARK_FIXTURE;
        expect(findViewProps(await render())?.benchmark).toBe(
            BENCHMARK_FIXTURE
        );
    });
});
