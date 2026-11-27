const { mockImageResponse, mockLoadOgFont } = vi.hoisted(() => ({
    mockImageResponse: vi.fn(),
    mockLoadOgFont: vi.fn(),
}));

vi.mock('next/og', () => ({
    ImageResponse: vi.fn().mockImplementation(function (jsx: unknown) {
        mockImageResponse(jsx);
        return {};
    }),
}));
vi.mock('@/entities/og-image/server/loadOgFont', () => ({
    loadOgFont: mockLoadOgFont,
}));

// @vitest-environment node
import type { ReactNode } from 'react';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { SITE_NAME } from '@/shared/config/brand';
import koMessages from '../../../../../messages/ko.json';
import enMessages from '../../../../../messages/en.json';
import jaMessages from '../../../../../messages/ja.json';
import zhMessages from '../../../../../messages/zh.json';

import Image, {
    contentType,
    dynamic,
    revalidate,
    size,
} from '../opengraph-image';
import TwitterImage, {
    dynamic as twitterDynamic,
    revalidate as twitterRevalidate,
} from '../twitter-image';

const HANGUL = /[가-힣]/;

const MESSAGES = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

/** 렌더 트리의 모든 문자열 자식을 문서 순서대로 모은다. */
function collectTexts(node: unknown): readonly string[] {
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap(collectTexts);
    if (typeof node === 'object' && node !== null && 'props' in node) {
        const { children } = (node as { props: { children?: ReactNode } })
            .props;
        return collectTexts(children);
    }
    return [];
}

const renderedTexts = (): readonly string[] =>
    collectTexts(mockImageResponse.mock.lastCall?.[0]);

describe('home opengraph-image', () => {
    beforeEach(() => {
        mockImageResponse.mockClear();
        mockLoadOgFont.mockReset();
        mockLoadOgFont.mockResolvedValue(null);
    });

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: 워드마크, 홈 제목, root.headline 세 줄만 그린다',
        async locale => {
            await Image({ params: Promise.resolve({ locale }) });

            expect(renderedTexts()).toEqual([
                SITE_NAME,
                MESSAGES[locale].app.home.page.headline,
                MESSAGES[locale].shared.seo.root.headline,
            ]);
        }
    );

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 카드에 한글이 없다(한글 글리프 없는 폰트)',
        async locale => {
            await Image({ params: Promise.resolve({ locale }) });

            expect(renderedTexts().join(' ')).not.toMatch(HANGUL);
        }
    );

    it('ko 카드는 옛 공용 카드의 제품에 없는 문구를 싣지 않는다', async () => {
        await Image({ params: Promise.resolve({ locale: 'ko' }) });

        expect(renderedTexts().join(' ')).not.toMatch(/챗봇|실시간 스캔|45종/);
    });

    it('해석된 로케일로 폰트를 읽는다', async () => {
        await Image({ params: Promise.resolve({ locale: 'ja' }) });

        expect(mockLoadOgFont.mock.calls.map(([arg]) => arg)).toContain('ja');
    });

    it('알 수 없는 로케일은 기본 로케일로 해석해 폰트를 읽는다', async () => {
        await Image({ params: Promise.resolve({ locale: 'xx' }) });

        expect(mockLoadOgFont.mock.calls.map(([arg]) => arg)).toContain('ko');
    });

    it('라우트 설정: 정적화, 30일 재검증, 공용 OG 규격', () => {
        expect(dynamic).toBe('force-static');
        expect(revalidate).toBe(2592000);
        expect(size).toEqual({
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
        });
        expect(contentType).toBe('image/png');
    });

    it('twitter-image가 같은 렌더러와 같은 설정을 쓴다', () => {
        expect(TwitterImage).toBe(Image);
        expect(twitterDynamic).toBe('force-static');
        expect(twitterRevalidate).toBe(revalidate);
    });
});
