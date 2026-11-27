vi.mock('@/entities/benchmark/release', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/benchmark/release')>()),
    getPublishedBenchmarkRelease: vi.fn(),
}));

import { buildLlmsDocument } from '@/app/api/llms/_lib/buildLlmsDocument';
import {
    LLMS_TXT_CACHE_CONTROL,
    LLMS_TXT_CONTENT_TYPE,
} from '@/app/api/llms/_lib/constants';
import { llmsInputs } from '@/app/api/llms/_lib/llmsInputs';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';
import { GET } from '@/app/api/llms/route';
import release from '@/entities/benchmark/data/release-2026-10.json';
import { assertBenchmarkRelease } from '@/entities/benchmark/lib/assertBenchmarkRelease';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { LLMS_TXT_PATH } from '@/shared/config/llmsTxt';
import nextConfig from '../../../../../next.config';

const REAL_RELEASE = assertBenchmarkRelease(release);

function request(host: string): Request {
    return new Request(`https://${host}/api/llms`, { headers: { host } });
}

describe('GET /api/llms', () => {
    beforeEach(() => {
        vi.mocked(getPublishedBenchmarkRelease).mockReturnValue(REAL_RELEASE);
    });

    it('메인 호스트: 200, 헤더 세 개, 메인 안내 파일 본문', async () => {
        const res = GET(request('siglens.io'));

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(LLMS_TXT_CONTENT_TYPE);
        expect(LLMS_TXT_CONTENT_TYPE).toBe('text/plain; charset=utf-8');
        expect(res.headers.get('Cache-Control')).toBe(LLMS_TXT_CACHE_CONTROL);
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
        expect((await res.text()).startsWith('# 시그렌즈 (SIGLENS)\n')).toBe(
            true
        );
    });

    it.each(['ai.siglens.io', 'ai.localhost:4300'])(
        '%s는 ai 안내 파일을 받는다',
        async host => {
            const text = await GET(request(host)).text();

            expect(text.startsWith('# 시그렌즈 AI (SIGLENS AI)\n')).toBe(true);
        }
    );

    it.each([
        ['siglens.io', 'main'],
        ['ai.siglens.io', 'ai'],
    ] as const)(
        '%s 본문은 빌더와 렌더러를 거친 값 그대로다(조립 경로가 하나)',
        async (host, kind) => {
            const text = await GET(request(host)).text();

            expect(text).toBe(
                renderLlmsTxt(buildLlmsDocument(kind, llmsInputs()))
            );
        }
    );

    it('공개 API 게이트는 요청마다 읽는다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', 'true');
        const on = await GET(request('siglens.io')).text();
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        const off = await GET(request('siglens.io')).text();

        expect(on).toContain('/developers)');
        expect(off).not.toContain('/developers');
    });

    it('벤치마크가 공개 전이면 두 호스트 모두 벤치마크 줄이 없다', async () => {
        vi.mocked(getPublishedBenchmarkRelease).mockReturnValue(null);

        const texts = await Promise.all(
            ['siglens.io', 'ai.siglens.io'].map(host =>
                GET(request(host)).text()
            )
        );

        texts.forEach(text => {
            expect(text).not.toContain('/benchmark');
            expect(text).not.toContain('.zip');
        });
    });
});

describe('nextConfig llms.txt rewrite', () => {
    it('공개 /llms.txt를 API 라우트로 보낸다', async () => {
        const rewrites = await nextConfig.rewrites?.();

        expect(rewrites).toContainEqual({
            source: '/llms.txt',
            destination: '/api/llms',
        });
    });

    it('rewrite 출처가 경로 상수와 같다', async () => {
        const rewrites = await nextConfig.rewrites?.();

        expect(rewrites).toContainEqual(
            expect.objectContaining({ source: LLMS_TXT_PATH })
        );
    });
});
