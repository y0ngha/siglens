/**
 * `AccountContent` — 회원 가드(로그인 이동)와, 공개 API 출시 플래그에 따라 "시그렌즈 API" 섹션과
 * 그 데이터 액션이 켜지고 꺼지는지. 비동기 서버 컴포넌트라 `react-dom/server` 스트림으로 최종
 * HTML을 읽는다.
 */
const { listKeys, getDefaultModel } = vi.hoisted(() => ({
    listKeys: vi.fn(),
    getDefaultModel: vi.fn(),
}));
vi.mock('@/features/api-key-management/ui/ApiKeySection', () => ({
    ApiKeySection: () => <div data-testid="byok-section">BYOK</div>,
}));
vi.mock(
    '@/features/siglens-api-key-management/ui/SiglensApiKeySection',
    () => ({
        SiglensApiKeySection: () => <div data-testid="siglens-api">API</div>,
    })
);
vi.mock('@/features/siglens-api-key-management/ui/DefaultModelForm', () => ({
    DefaultModelForm: () => null,
}));
vi.mock('@/features/email-report-settings/ui/EmailReportLinkCard', () => ({
    EmailReportLinkCard: () => null,
}));
vi.mock('@/entities/siglens-api-key/actions/listSiglensApiKeysAction', () => ({
    listSiglensApiKeysAction: listKeys,
}));
vi.mock('@/entities/siglens-api-key/actions/getApiDefaultModelAction', () => ({
    getApiDefaultModelAction: getDefaultModel,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/api-key/actions/getRegisteredProvidersAction', () => ({
    getRegisteredProvidersAction: vi.fn(async () => []),
}));
vi.mock('@/shared/ui/LocaleLink', () => ({ LocaleLink: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(() => {
        throw new Error('NEXT_REDIRECT');
    }),
}));

import { redirect } from 'next/navigation';
import { renderToReadableStream } from 'react-dom/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { AccountContent } from '../AccountContent';

const MEMBER = {
    id: 'u1',
    email: 'a@b.c',
    name: null,
    tier: 'free',
    emailVerified: true,
} as never;

async function renderHtml(): Promise<string> {
    const stream = await renderToReadableStream(
        await AccountContent({ locale: 'ko' })
    );
    await stream.allReady;
    return new Response(stream).text();
}

describe('AccountContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listKeys.mockResolvedValue([]);
        getDefaultModel.mockResolvedValue(null);
    });

    it('세션이 유효하지 않으면 돌아올 경로를 달아 로케일 로그인으로 보낸다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);

        await expect(AccountContent({ locale: 'en' })).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(redirect).toHaveBeenCalledWith('/en/login?next=%2Fen%2Faccount');
    });

    it('회원이면 프로필 이메일과 BYOK 섹션을 그린다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(MEMBER);

        const html = await renderHtml();

        expect(html).toContain('a@b.c');
        expect(html).toContain('data-testid="byok-section"');
    });

    it('출시 플래그가 꺼져 있으면 시그렌즈 API 섹션을 그리지 않는다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        vi.mocked(getCurrentUser).mockResolvedValue(MEMBER);

        const html = await renderHtml();

        expect(html).not.toContain('data-testid="siglens-api"');
        expect(html).not.toContain('aria-label="시그렌즈 API"');
    });

    it('출시 플래그가 꺼져 있으면 키·기본 모델 액션을 부르지 않는다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        vi.mocked(getCurrentUser).mockResolvedValue(MEMBER);

        await renderHtml();

        expect(listKeys).not.toHaveBeenCalled();
        expect(getDefaultModel).not.toHaveBeenCalled();
    });

    it('출시 플래그가 켜져 있으면 시그렌즈 API 섹션을 그린다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', 'true');
        vi.mocked(getCurrentUser).mockResolvedValue(MEMBER);

        const html = await renderHtml();

        expect(html).toContain('aria-label="시그렌즈 API"');
        expect(html).toContain('data-testid="siglens-api"');
    });

    it('출시 플래그가 켜져 있으면 키·기본 모델 액션을 한 번씩 부른다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', 'true');
        vi.mocked(getCurrentUser).mockResolvedValue(MEMBER);

        await renderHtml();

        expect(listKeys).toHaveBeenCalledTimes(1);
        expect(getDefaultModel).toHaveBeenCalledTimes(1);
    });
});
