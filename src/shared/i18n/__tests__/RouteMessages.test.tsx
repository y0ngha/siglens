// @vitest-environment node
import type { AbstractIntlMessages } from 'next-intl';
import { RouteMessages } from '../RouteMessages';

/**
 * `RouteMessages`는 RSC이고 `render()`가 요구하는 DOM 없이 반환 트리를 직접
 * 검사한다 — `MarketRouteBody` 테스트(`page.test.ts`)와 같은 패턴이다.
 */
describe('RouteMessages', () => {
    it('children을 그대로 감싼다', async () => {
        const tree = (await RouteMessages({
            route: 'market',
            locale: 'ko',
            children: <div data-testid="probe">probe</div>,
        })) as unknown as {
            props: {
                locale: string;
                messages: Record<string, unknown>;
                children: unknown;
            };
        };

        expect(tree.props.locale).toBe('ko');
        expect(JSON.stringify(tree.props.children)).toContain('probe');
    });

    /**
     * 라우트가 실제로 쓰는 네임스페이스만 프로바이더에 실린다 — 카탈로그
     * 전체(수천 키)를 그대로 내려보내면 first-load JS가 회귀한다는 것이
     * 이 컴포넌트의 존재 이유다. `market`의 서버 전용 네임스페이스(`shared.seo`)가
     * 클라이언트 페이로드에 없는지로 그 좁히기가 실제로 일어남을 확인한다.
     */
    it('라우트가 쓰지 않는 서버 전용 네임스페이스(shared.seo)는 실지 않는다', async () => {
        const tree = (await RouteMessages({
            route: 'market',
            locale: 'ko',
            children: <div>x</div>,
        })) as unknown as {
            props: { messages: { shared?: Record<string, unknown> } };
        };

        expect(tree.props.messages.shared).not.toHaveProperty('seo');
    });

    /**
     * 알 수 없는 라우트(추출을 아직 안 돌린 새 페이지)는 크롬 키로 폴백한다 —
     * `clientNamespaces.routeClientPaths`가 이미 보장하는 계약을, 이 컴포넌트가
     * 실제로 그 함수를 거쳐 메시지를 좁히는지로 다시 확인한다.
     */
    it('알 수 없는 라우트는 크롬 키로 좁혀 렌더한다(카탈로그 전체를 내려보내지 않는다)', async () => {
        const koMessages = (await import('../../../../messages/ko.json'))
            .default as Record<string, unknown>;

        const tree = (await RouteMessages({
            route: '__no-such-route__',
            locale: 'ko',
            children: <div>x</div>,
        })) as unknown as { props: { messages: Record<string, unknown> } };

        expect(Object.keys(tree.props.messages).length).toBeLessThan(
            Object.keys(koMessages).length
        );
    });
});

describe('RouteMessages — 상위 프로바이더와의 차이만 보낸다', () => {
    it('크롬 키는 다시 보내지 않는다(루트 프로바이더가 이미 실었다)', async () => {
        const { CHROME_CLIENT_PATHS } = await import('../clientNamespaces');
        const { loadMessages, pickMessages } = await import('../loadMessages');
        const chrome = pickMessages(
            await loadMessages('ko'),
            CHROME_CLIENT_PATHS
        );
        const tree = (await RouteMessages({
            route: 'market',
            locale: 'ko',
            children: <div>x</div>,
        })) as unknown as { props: { messages: Record<string, unknown> } };

        const sent = JSON.stringify(tree.props.messages);
        // 크롬 서브트리의 대표 잎 하나가 다시 실리지 않는다.
        const widgetsLayout = (
            chrome as { widgets?: { layout?: Record<string, unknown> } }
        ).widgets?.layout;
        const [someKey] = Object.keys(widgetsLayout ?? {});
        expect(someKey).toBeDefined();
        expect(
            (
                tree.props.messages as {
                    widgets?: { layout?: Record<string, unknown> };
                }
            ).widgets?.layout?.[someKey!]
        ).toBeUndefined();
        expect(sent.length).toBeGreaterThan(2);
    });

    it('탭 라우트는 [symbol] 레이아웃이 이미 실은 키도 다시 보내지 않는다', async () => {
        const { routeClientPaths } = await import('../clientNamespaces');
        const { loadMessages, pickMessages } = await import('../loadMessages');
        const { omitMessages } = await import('../messageDiff');
        const messages = await loadMessages('ko');
        const tree = (await RouteMessages({
            route: '[symbol]/news',
            locale: 'ko',
            children: <div>x</div>,
        })) as unknown as { props: { messages: AbstractIntlMessages } };

        const symbolSet = pickMessages(messages, routeClientPaths('[symbol]'));
        // 보낸 차이에서 [symbol] 키를 빼도 그대로다 = 겹치는 잎이 없다.
        expect(omitMessages(tree.props.messages, symbolSet)).toEqual(
            tree.props.messages
        );
    });
});
