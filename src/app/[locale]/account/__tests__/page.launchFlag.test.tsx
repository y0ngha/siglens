/**
 * 공개 API 출시 플래그에 따라 `/account`가 "시그렌즈 API" 섹션을 그리는지, 그 데이터 액션을 부르는지 본다.
 * 서버 컴포넌트(Suspense + async)라 `react-dom/server`의 스트림으로 최종 HTML을 읽는다.
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
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(async () => ({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        tier: 'free',
        emailVerified: true,
    })),
}));
vi.mock('@/entities/api-key/actions/getRegisteredProvidersAction', () => ({
    getRegisteredProvidersAction: vi.fn(async () => []),
}));
vi.mock('@/shared/ui/LocaleLink', () => ({ LocaleLink: () => null }));

import { NextIntlClientProvider } from 'next-intl';
import { renderToReadableStream } from 'react-dom/server';
import ko from '../../../../../messages/ko.json';
import AccountPage from '@/app/[locale]/account/page';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';

/**
 * 본문(`AccountContent`)을 끝나지 않는 세션 조회로 붙잡아 Suspense fallback(`AccountContentSkeleton`)만
 * 보내게 한다. 셸이 준비되면 첫 청크만 읽고 스트림을 닫는다.
 */
async function renderSkeletonHtml(): Promise<string> {
    vi.mocked(getCurrentUser).mockImplementationOnce(
        () => new Promise(() => undefined)
    );
    const element = await AccountPage({
        params: Promise.resolve({ locale: 'ko' }),
    });
    const stream = await renderToReadableStream(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {element}
        </NextIntlClientProvider>
    );
    const reader = stream.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    return new TextDecoder().decode(value);
}

async function renderAccountHtml(): Promise<string> {
    const element = await AccountPage({
        params: Promise.resolve({ locale: 'ko' }),
    });
    // Suspense fallback(스켈레톤)이 `useTranslations`를 쓰므로 클라이언트 컨텍스트를 감싼다.
    const stream = await renderToReadableStream(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {element}
        </NextIntlClientProvider>
    );
    await stream.allReady;
    return new Response(stream).text();
}

describe('Account page - 공개 API 출시 플래그', () => {
    beforeEach(() => {
        listKeys.mockReset().mockResolvedValue([]);
        getDefaultModel.mockReset().mockResolvedValue(null);
    });

    it('꺼짐: 시그렌즈 API 섹션을 그리지 않고 데이터 액션도 부르지 않으며 BYOK 섹션은 남는다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        const html = await renderAccountHtml();
        expect(html).toContain('data-testid="byok-section"');
        expect(html).not.toContain('data-testid="siglens-api"');
        expect(listKeys).not.toHaveBeenCalled();
        expect(getDefaultModel).not.toHaveBeenCalled();
    });

    it('켜짐: 시그렌즈 API 섹션을 그리고 데이터 액션을 부른다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', 'true');
        const html = await renderAccountHtml();
        expect(html).toContain('data-testid="siglens-api"');
        expect(listKeys).toHaveBeenCalledTimes(1);
        expect(getDefaultModel).toHaveBeenCalledTimes(1);
    });

    it('꺼짐: 로딩 스켈레톤에도 시그렌즈 API 섹션을 그리지 않는다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        const html = await renderSkeletonHtml();
        // 스켈레톤이 실제로 렌더됐음을 먼저 확인한다(빈 문자열로 공허하게 통과하지 않게).
        expect(html).toContain('animate-pulse');
        expect(html).toContain('aria-label="AI 모델 API 키 로딩 중"');
        expect(html).not.toContain('aria-label="시그렌즈 API"');
    });

    it('켜짐: 로딩 스켈레톤이 시그렌즈 API 섹션을 그린다', async () => {
        vi.stubEnv('PUBLIC_API_ENABLED', 'true');
        const html = await renderSkeletonHtml();
        expect(html).toContain('aria-label="시그렌즈 API"');
    });
});
