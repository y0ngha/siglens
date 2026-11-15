vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return { ...nextIntlServerStub('ko'), setRequestLocale: vi.fn() };
});
const notFound = vi.hoisted(() =>
    vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    })
);
vi.mock('next/navigation', () => ({ notFound }));
const hubData = vi.hoisted(() => ({
    value: { rows: [] as unknown[], degraded: false },
}));
vi.mock('../../_lib/loadSignalHub', () => ({
    loadSignalHub: vi.fn(async () => hubData.value),
}));
vi.mock('../../_components/SignalHubBody', () => ({
    SignalHubBody: () => null,
}));

import ko from '../../../../../../../messages/ko.json';
import SignalHubPage, {
    generateMetadata,
    generateStaticParams,
    revalidate,
} from '../page';

const params = (signal: string) => Promise.resolve({ locale: 'ko', signal });

function rows(count: number): unknown[] {
    return Array.from({ length: count }, (_, i) => ({ symbol: `S${i}` }));
}

beforeEach(() => {
    notFound.mockClear();
    hubData.value = { rows: rows(5), degraded: false };
});

describe('/market/signals/[signal]', () => {
    it('ISR 설정: 1시간 리터럴, 빌드 때는 그리지 않는다(on-demand)', () => {
        expect(revalidate).toBe(3600);
        expect(generateStaticParams()).toEqual([]);
    });

    it('목록에 없는 신호는 페이지·메타데이터 모두 404', async () => {
        await expect(
            SignalHubPage({ params: params('cci-cross') })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        await expect(
            generateMetadata({ params: params('cci-cross') })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('색인 기준 이상이면 index, 제목·설명에 신호 이름이 들어간다', async () => {
        const meta = await generateMetadata({ params: params('golden-cross') });
        const signal = ko.shared.enumLabel.signalType.golden_cross;

        expect(meta.title).toBe(
            ko.app.market.signalHub.title.replace('{signal}', signal)
        );
        expect(String(meta.description)).toContain(signal);
        expect(meta.robots).toMatchObject({ index: true, follow: true });
        expect(meta.alternates?.canonical).toContain(
            '/market/signals/golden-cross'
        );
    });

    it('행이 모자라면 noindex,follow', async () => {
        hubData.value = { rows: rows(4), degraded: false };

        const meta = await generateMetadata({ params: params('golden-cross') });

        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('기록을 못 읽으면(degraded) noindex,follow', async () => {
        hubData.value = { rows: [], degraded: true };

        const meta = await generateMetadata({ params: params('death-cross') });

        expect(meta.robots).toEqual({ index: false, follow: true });
    });
});
