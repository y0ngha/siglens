const loadView = vi.hoisted(() => vi.fn());
vi.mock('@/entities/mail-alert/server/loadMailAlertManageView', () => ({
    loadMailAlertManageView: loadView,
}));
const manageProps = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/features/mail-alert/ui/MailAlertManage', () => ({
    MailAlertManage: (props: unknown) => {
        manageProps.value = props;
        return <div data-testid="manage" />;
    },
}));
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));
vi.mock('next-intl/server', async () => {
    const { catalogTranslator } =
        await import('@/shared/test-utils/catalogTranslator');
    return {
        setRequestLocale: vi.fn(),
        getTranslations: async (
            arg: string | { locale?: string; namespace?: string }
        ) =>
            typeof arg === 'string'
                ? catalogTranslator(arg, 'ko')
                : catalogTranslator(arg.namespace ?? '', arg.locale ?? 'ko'),
    };
});

import { screen } from '@testing-library/react';
import MailAlertsPage, {
    dynamic,
    generateMetadata,
} from '@/app/[locale]/email-report/alerts/page';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import type { ReactElement } from 'react';

const params = (locale: string) => Promise.resolve({ locale });
const search = (value: { s?: string; sig?: string } = {}) =>
    Promise.resolve(value);

async function renderPage(query: { s?: string; sig?: string } = {}) {
    const tree = await MailAlertsPage({
        params: params('ko'),
        searchParams: search(query),
    });
    return renderWithIntl((await resolveAsyncServerTree(tree)) as ReactElement);
}

beforeEach(() => {
    vi.clearAllMocks();
    manageProps.value = null;
});

describe('알림 메일 설정 페이지', () => {
    it('요청마다 렌더한다(개인 화면이라 ISR 대상이 아니다)', () => {
        expect(dynamic).toBe('force-dynamic');
    });

    it('메타데이터는 색인하지 않고 로케일별 canonical과 설명을 명시한다(AP-3)', async () => {
        const ko = await generateMetadata({ params: params('ko') });
        const en = await generateMetadata({ params: params('en') });

        expect(ko.title).toBe('알림 메일 설정');
        expect(ko.description).toEqual(expect.any(String));
        expect(ko.robots).toEqual({ index: false, follow: false });
        expect(ko.alternates?.canonical).toBe(
            'https://siglens.io/email-report/alerts'
        );
        expect(en.alternates?.canonical).toBe(
            'https://siglens.io/en/email-report/alerts'
        );
        expect(en.title).toBe('Alert email settings');
    });

    it('설정 링크의 s·sig를 읽어 서버 로더에 넘긴다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage({ s: 'sub-1', sig: 'abc' });

        expect(loadView).toHaveBeenCalledWith({ s: 'sub-1', sig: 'abc' });
    });

    it('링크가 없으면 undefined를 넘긴다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(loadView).toHaveBeenCalledWith(undefined);
    });

    it('목록 상태: 항목 이름을 서버에서 번역해 클라이언트 목록에 넘긴다', async () => {
        loadView.mockResolvedValue({
            status: 'ready',
            view: {
                maskedEmail: 'g***@example.com',
                topics: [
                    { kind: 'symbol', symbol: 'AAPL' },
                    { kind: 'signal', signalType: 'golden_cross' },
                    { kind: 'fear_greed', market: 'kr' },
                ],
                includePortfolio: true,
            },
        });

        await renderPage({ s: 'sub-1', sig: 'abc' });

        expect(screen.getByTestId('manage')).toBeInTheDocument();
        expect(manageProps.value).toMatchObject({
            maskedEmail: 'g***@example.com',
            includePortfolio: true,
            link: { s: 'sub-1', sig: 'abc' },
            topics: [
                { label: 'AAPL 새 신호' },
                { label: '새로 잡힌 골든크로스 종목' },
                { label: '한국 공포 탐욕 지수 극단 구간 진입' },
            ],
        });
    });

    it('알아보지 못하면 메일 속 링크로 열어 달라는 안내와 로그인 링크를 보인다', async () => {
        loadView.mockResolvedValue({ status: 'unidentified' });

        await renderPage();

        expect(
            screen.getByText('메일 속 링크로 열어 주세요')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '로그인하기' })
        ).toHaveAttribute('href', '/login');
        expect(screen.queryByTestId('manage')).not.toBeInTheDocument();
    });

    it('받는 항목이 없으면 빈 상태 문구다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(
            screen.getByText('받고 있는 알림 메일이 없어요.')
        ).toBeInTheDocument();
    });

    it('불러올 수 없으면(공개 전·테이블 없음) 안내 문구다', async () => {
        loadView.mockResolvedValue({ status: 'unavailable' });

        await renderPage();

        expect(
            screen.getByText(/지금은 설정을 불러올 수 없어요/)
        ).toBeInTheDocument();
    });

    it('제목과 섹션 이름이 같다(AX-1)', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: '알림 메일 설정' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: '알림 메일 설정' })
        ).toBeInTheDocument();
    });
});
