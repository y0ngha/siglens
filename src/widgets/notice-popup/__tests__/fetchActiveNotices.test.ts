import type { NoticeWireRecord } from '@/entities/notice/model/types';
import { fetchActiveNotices } from '../utils/fetchActiveNotices';

const WIRE: NoticeWireRecord = {
    id: 'w1',
    title: '점검',
    body: '본문',
    linkUrl: null,
    linkLabel: null,
    pathPattern: null,
    createdAt: '2026-06-03T01:02:03.000Z',
};

describe('fetchActiveNotices', () => {
    let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

    beforeEach(() => {
        fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('로케일을 쿼리로 넘기고 호출자의 AbortSignal을 그대로 전달한다', async () => {
        fetchMock.mockResolvedValue(Response.json([]));
        const controller = new AbortController();
        await fetchActiveNotices('zh-Hant', controller.signal);
        expect(fetchMock).toHaveBeenCalledWith('/api/notices?locale=zh-Hant', {
            signal: controller.signal,
        });
    });

    it('로케일의 특수 문자는 인코딩한다', async () => {
        fetchMock.mockResolvedValue(Response.json([]));
        await fetchActiveNotices('a&b', new AbortController().signal);
        expect(fetchMock).toHaveBeenCalledWith('/api/notices?locale=a%26b', {
            signal: expect.any(AbortSignal),
        });
    });

    it('createdAt ISO 문자열을 Date로 되돌린다', async () => {
        fetchMock.mockResolvedValue(Response.json([WIRE]));
        const [record] = await fetchActiveNotices(
            'ko',
            new AbortController().signal
        );
        expect(record?.createdAt).toEqual(new Date('2026-06-03T01:02:03.000Z'));
        expect(record?.id).toBe('w1');
    });

    it('2xx가 아니면 상태 코드를 담아 던진다', async () => {
        fetchMock.mockResolvedValue(new Response('oops', { status: 503 }));
        await expect(
            fetchActiveNotices('ko', new AbortController().signal)
        ).rejects.toThrow('notices HTTP 503');
    });
});
