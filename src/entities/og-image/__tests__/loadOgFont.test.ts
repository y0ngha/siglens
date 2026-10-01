import { loadOgFont } from '../lib/loadOgFont';

describe('loadOgFont', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it.each([
        ['ko', 'Pretendard', /pretendard-bold\.otf$/],
        ['en', 'Pretendard', /pretendard-bold\.otf$/],
        ['ja', 'Noto Sans JP', /noto-sans-jp-japanese-700-normal\.woff$/],
        [
            'zh',
            'Noto Sans SC',
            /noto-sans-sc-chinese-simplified-700-normal\.woff$/,
        ],
    ] as const)(
        '%s → %s 폰트를 받아 fonts 항목으로 돌려준다',
        async (locale, name, url) => {
            const mockBuffer = new ArrayBuffer(8);
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
            });
            global.fetch = fetchMock;

            const result = await loadOgFont(locale);

            expect(result).toEqual({
                name,
                data: mockBuffer,
                style: 'normal',
                weight: 700,
            });
            expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
                expect.stringMatching(url),
            ]);
        }
    );

    it('res.ok가 false면 null을 반환한다', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            arrayBuffer: vi.fn(),
        });

        const result = await loadOgFont('ko');

        expect(result).toBeNull();
    });

    it('fetch가 throw하면 null을 반환해 graceful degrade한다', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

        const result = await loadOgFont('ja');

        expect(result).toBeNull();
    });

    it('arrayBuffer()가 throw해도 null을 반환한다', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockRejectedValue(new Error('decode error')),
        });

        const result = await loadOgFont('zh');

        expect(result).toBeNull();
    });
});
