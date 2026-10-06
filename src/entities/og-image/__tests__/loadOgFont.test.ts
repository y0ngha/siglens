import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
    createOgFontLoader,
    OG_FONT_BY_LOCALE,
    type OgFontSource,
} from '../lib/loadOgFont';
import type { Locale } from '@/shared/i18n/locales';

// 실제 HTTP 서버로 다운로드·메모·실패 처리를 본다. 경로별 응답과 요청 횟수를 기록한다.
function startServer(routes: Record<string, { status: number; body: Buffer }>) {
    const hits: string[] = [];
    const server = http.createServer((req, res) => {
        hits.push(req.url ?? '');
        const route = routes[req.url ?? ''];
        if (!route) {
            res.writeHead(404);
            res.end();
            return;
        }
        res.writeHead(route.status);
        res.end(route.body);
    });
    return new Promise<{
        base: string;
        hits: string[];
        close: () => Promise<void>;
    }>(resolve => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            resolve({
                base: `http://127.0.0.1:${port}`,
                hits,
                close: () => new Promise(r => server.close(() => r())),
            });
        });
    });
}

function sources(base: string): Record<Locale, OgFontSource> {
    const shared = { name: 'Pretendard', url: `${base}/pretendard.otf` };
    return {
        ko: shared,
        en: shared,
        ja: { name: 'Noto Sans JP', url: `${base}/jp.woff` },
        zh: { name: 'Noto Sans SC', url: `${base}/missing.woff` },
    };
}

const FONT_BYTES = Buffer.from([1, 2, 3, 4, 5]);

describe('OG_FONT_BY_LOCALE', () => {
    it.each([
        ['ko', 'Pretendard', /pretendard@v1\.3\.9\/.*pretendard-bold\.otf$/],
        ['en', 'Pretendard', /pretendard@v1\.3\.9\/.*pretendard-bold\.otf$/],
        [
            'ja',
            'Noto Sans JP',
            /noto-sans-jp@5\.3\.0\/.*noto-sans-jp-japanese-700-normal\.woff$/,
        ],
        [
            'zh',
            'Noto Sans SC',
            /noto-sans-sc@5\.3\.0\/.*noto-sans-sc-chinese-simplified-700-normal\.woff$/,
        ],
    ] as const)('%s → %s (버전 고정 URL)', (locale, name, url) => {
        expect(OG_FONT_BY_LOCALE[locale].name).toBe(name);
        expect(OG_FONT_BY_LOCALE[locale].url).toMatch(url);
    });
});

describe('createOgFontLoader', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Next 데이터 캐시(패치된 전역 fetch)를 타면 안 된다 — 탔다면 이 거부가 null로 드러난다.
        fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('global fetch must not be used'));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('폰트를 받아 fonts 항목으로 돌려준다(전역 fetch 미사용)', async () => {
        const server = await startServer({
            '/jp.woff': { status: 200, body: FONT_BYTES },
        });
        try {
            const load = createOgFontLoader(sources(server.base));
            const font = await load('ja');
            expect(font).not.toBeNull();
            expect(font!.name).toBe('Noto Sans JP');
            expect(font!.style).toBe('normal');
            expect(font!.weight).toBe(700);
            expect(Buffer.from(font!.data)).toEqual(FONT_BYTES);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            await server.close();
        }
    });

    it('같은 URL은 프로세스당 한 번만 받는다(동시 호출·로케일 공유 포함)', async () => {
        const server = await startServer({
            '/pretendard.otf': { status: 200, body: FONT_BYTES },
        });
        try {
            const load = createOgFontLoader(sources(server.base));
            const [a, b] = await Promise.all([load('ko'), load('en')]);
            const c = await load('ko');
            expect(a!.data).toBe(b!.data);
            expect(c!.data).toBe(a!.data);
            expect(server.hits).toEqual(['/pretendard.otf']);
        } finally {
            await server.close();
        }
    });

    it('비 200 응답이면 null이고, 실패는 기억하지 않아 다음 호출이 다시 시도한다', async () => {
        const server = await startServer({});
        try {
            const load = createOgFontLoader(sources(server.base));
            await expect(load('zh')).resolves.toBeNull();
            await expect(load('zh')).resolves.toBeNull();
            expect(server.hits).toEqual(['/missing.woff', '/missing.woff']);
        } finally {
            await server.close();
        }
    });

    it('연결 실패면 null을 반환해 graceful degrade한다', async () => {
        const server = await startServer({});
        const { base } = server;
        await server.close();
        const load = createOgFontLoader(sources(base));
        await expect(load('ja')).resolves.toBeNull();
    });
});
