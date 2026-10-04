/**
 * `/economy` 본문 로더의 **출발 순서**.
 *
 * 캘린더(DB)는 스냅샷·브리핑과 무관한 조회인데, 예전에는 그 둘을 다 기다린 뒤에야
 * 시작해 콜드 렌더가 조회 세 개를 한 줄로 기다렸다. 순서는 렌더 결과에 드러나지 않으므로
 * (결과는 같다) `page.test.tsx`의 렌더 단언으로는 되돌려도 잡히지 않는다 — 여기서 따로 고정한다.
 *
 * 본문은 렌더하지 않고 직접 실행하며 degrade 분기로 끝낸다. 그래서 목은 그 경로가 실제로
 * 부르는 로더뿐이다.
 */
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: vi.fn(),
}));
vi.mock('@/entities/economy/api/getCalendarFromDb', () => ({
    getCalendarFromDb: vi.fn(),
}));
vi.mock('@/entities/economy/api/resolveIndicatorLabels', () => ({
    resolveIndicatorLabels: vi.fn(),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
    shortenRevalidateIfDatabaseMissingAtBuild: vi.fn(async () => undefined),
}));

import { afterEach, describe, it, expect, vi } from 'vitest';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';

describe('EconomyContent 로더 출발 순서', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('스냅샷을 기다리는 동안 캘린더 조회가 이미 출발해 있다', async () => {
        // 스냅샷은 테스트가 풀어 줄 때까지 대기 상태로 둔다. 실패로 풀면 본문이 degrade
        // 분기로 끝나므로 그 뒤의 로더를 흉내 낼 필요가 없다.
        let failSnapshot: (reason: Error) => void = () => {};
        vi.mocked(getEconomySnapshotStatic).mockReturnValue(
            new Promise((_resolve, reject) => {
                failSnapshot = reject;
            })
        );
        vi.mocked(getCalendarFromDb).mockResolvedValue([]);
        vi.mocked(resolveIndicatorLabels).mockResolvedValue({});
        // 본문은 스냅샷 실패를 console.error로 남긴다(아래 finally에서 일부러 실패시킨다).
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const { default: EconomyPage } =
            await import('@/app/[locale]/economy/page');
        const tree = await EconomyPage({
            params: Promise.resolve({ locale: 'ko' }),
        });
        // 셸 안의 async 본문(EconomyContent)을 직접 실행한다 — Suspense의 자식이다.
        const content = findAsyncChild(tree);
        const pending = content.type(content.props);

        try {
            // 스냅샷은 아직 풀리지 않았다. 캘린더가 스냅샷 뒤에 줄을 서 있다면 이 대기는
            // 끝나지 않는다(타임아웃으로 실패).
            await vi.waitFor(() =>
                expect(getCalendarFromDb).toHaveBeenCalledTimes(1)
            );
        } finally {
            // 단언이 실패해도 대기 중인 본문을 끝내고 나간다.
            failSnapshot(new Error('snapshot unavailable'));
            await pending;
        }
    });
});

type ContentElement = {
    type: (props: unknown) => Promise<unknown>;
    props: unknown;
};

/** 페이지 셸에서 async 본문 컴포넌트(`EconomyContent`) 요소를 이름으로 찾는다. */
function findAsyncChild(node: unknown): ContentElement {
    const found = collectElements(node).find(
        element =>
            typeof element.type === 'function' &&
            element.type.name === 'EconomyContent'
    );
    if (!found) throw new Error('EconomyContent 요소를 찾지 못했다');
    return found as unknown as ContentElement;
}

type AnyElement = { type: unknown; props: { children?: unknown } };

/** 트리의 모든 React 요소를 깊이 우선으로 펼친다. */
function collectElements(node: unknown): AnyElement[] {
    if (Array.isArray(node)) return node.flatMap(collectElements);
    if (node === null || typeof node !== 'object' || !('type' in node)) {
        return [];
    }
    const element = node as AnyElement;
    return [element, ...collectElements(element.props?.children)];
}
