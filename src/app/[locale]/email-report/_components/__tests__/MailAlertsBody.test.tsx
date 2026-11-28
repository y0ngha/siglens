vi.mock('@/entities/ticker/server/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));
vi.mock('@/features/mail-alert/ui/MailAlertManage', () => ({
    MailAlertManage: ({
        topics,
        priceAlerts,
        firedPriceAlerts,
    }: {
        topics: { label: string }[];
        priceAlerts: { label: string }[];
        firedPriceAlerts: { text: string }[];
    }) => (
        <ul>
            {topics.map(t => (
                <li key={t.label} data-kind="topic">
                    {t.label}
                </li>
            ))}
            {priceAlerts.map(a => (
                <li key={a.label} data-kind="alert">
                    {a.label}
                </li>
            ))}
            {firedPriceAlerts.map(a => (
                <li key={a.text} data-kind="fired">
                    {a.text}
                </li>
            ))}
        </ul>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { MockInstance } from 'vitest';
import type {
    MailAlertManageView,
    PriceAlertView,
} from '@/entities/mail-alert/model';
import { getAssetInfoStatic } from '@/entities/ticker/server/getAssetInfoStatic';
import type { Locale } from '@/shared/i18n/locales';
import { MailAlertsBody } from '../MailAlertsBody';

function alert(id: string, symbol: string, fired = false): PriceAlertView {
    return {
        id,
        symbol,
        market: 'us',
        condition: { kind: 'close_above', level: 100 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 90,
        createdAt: new Date('2026-11-01T00:00:00Z'),
        expiresOn: '2026-12-01',
        status: fired ? 'fired' : 'active',
        firedSession: fired ? '2026-11-20' : null,
        firedClose: fired ? 101 : null,
        firedAt: null,
    } as PriceAlertView;
}

const view: MailAlertManageView = {
    maskedEmail: 'a***@example.com',
    topics: [{ kind: 'symbol', symbol: 'NVDA' }],
    includePortfolio: null,
    priceAlerts: [alert('a1', 'NVDA')],
    firedPriceAlerts: [alert('f1', 'NVDA', true)],
};

async function renderBody(locale: Locale, v = view) {
    render(
        await MailAlertsBody({
            load: { status: 'ready', view: v },
            link: undefined,
            locale,
        })
    );
}

const NVIDIA = { name: 'NVIDIA Corporation', koreanName: '엔비디아' };

describe('MailAlertsBody 종목 표기', () => {
    let warn: MockInstance<typeof console.warn>;

    beforeEach(() => {
        vi.clearAllMocks();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('이름을 찾았을 때', () => {
        it('주제, 진행 중 알림, 알린 알림 모두 한글명과 코드로 보이고 종목은 한 번만 조회한다', async () => {
            vi.mocked(getAssetInfoStatic).mockResolvedValue(NVIDIA as never);

            await renderBody('ko');

            expect(
                screen.getByText(/^엔비디아 \(NVDA\) 추세 변화/)
            ).toBeVisible();
            expect(
                screen.getByText(/^엔비디아 \(NVDA\) 종가가 \$100/)
            ).toBeVisible();
            expect(
                screen.getByText(/^엔비디아 \(NVDA\) 종가가 11월 20일/)
            ).toBeVisible();
            expect(getAssetInfoStatic).toHaveBeenCalledTimes(1);
            expect(getAssetInfoStatic).toHaveBeenCalledWith('NVDA');
        });
    });

    describe('로케일', () => {
        it('en은 영문 법인명을 쓴다', async () => {
            vi.mocked(getAssetInfoStatic).mockResolvedValue(NVIDIA as never);

            await renderBody('en');

            expect(
                screen.getByText(/^NVIDIA Corporation \(NVDA\) 추세 변화/)
            ).toBeVisible();
            expect(screen.queryByText(/엔비디아/)).toBeNull();
        });
    });

    describe('조회가 실패했을 때', () => {
        it('결과가 없으면 코드만 보인다', async () => {
            vi.mocked(getAssetInfoStatic).mockResolvedValue(null);

            await renderBody('ko');

            expect(screen.getByText(/^NVDA 추세 변화/)).toBeVisible();
            expect(screen.getByText(/^NVDA 종가가 \$100/)).toBeVisible();
            expect(warn).not.toHaveBeenCalled();
        });

        it('던지면 코드만 보이고, 종목을 담아 한 번 경고하되 원본 에러는 로그에 싣지 않는다', async () => {
            // 평범한 에러는 그대로 로그에 가고, DB 에러(바인딩 값을 든 쪽)만 redact된다.
            const original = Object.assign(new Error('db down'), {
                name: 'PostgresError',
                query: 'select * from users where email = $1',
                parameters: ['secret@example.com'],
            });
            vi.mocked(getAssetInfoStatic).mockRejectedValue(original);

            await renderBody('ko');

            expect(screen.getByText(/^NVDA 추세 변화/)).toBeVisible();
            expect(screen.getByText(/^NVDA 종가가 \$100/)).toBeVisible();
            expect(warn).toHaveBeenCalledTimes(1);
            const [message, detail] = warn.mock.calls.flat();
            expect(message).toContain('NVDA');
            expect(detail).not.toBe(original);
            expect(JSON.stringify(detail)).not.toContain('secret@example.com');
        });

        it('끝나지 않는 조회는 시간 상한 뒤 코드로 떨어지고 끝난 종목의 이름은 지킨다', async () => {
            vi.useFakeTimers();
            vi.mocked(getAssetInfoStatic).mockImplementation(((s: string) =>
                s === 'NVDA'
                    ? new Promise(() => undefined)
                    : Promise.resolve({
                          name: 'Samsung',
                          koreanName: '삼성전자',
                      })) as never);

            const rendering = renderBody('ko', {
                ...view,
                topics: [
                    { kind: 'symbol', symbol: 'NVDA' },
                    { kind: 'symbol', symbol: '005930' },
                ],
                priceAlerts: [],
                firedPriceAlerts: [],
            });
            await vi.advanceTimersByTimeAsync(2000);
            await rendering;

            expect(screen.getByText(/^NVDA 추세 변화/)).toBeVisible();
            expect(screen.getByText(/^삼성전자 \(005930\) 추세/)).toBeVisible();
        });
    });

    describe('종목이 여러 개일 때', () => {
        it('각각 한 번씩 조회하고 이름을 섞지 않는다', async () => {
            vi.mocked(getAssetInfoStatic).mockImplementation(((s: string) =>
                Promise.resolve(
                    s === 'NVDA'
                        ? { name: 'NVIDIA', koreanName: '엔비디아' }
                        : { name: 'Samsung', koreanName: '삼성전자' }
                )) as never);

            await renderBody('ko', {
                ...view,
                topics: [
                    { kind: 'symbol', symbol: 'NVDA' },
                    { kind: 'symbol', symbol: '005930' },
                ],
                priceAlerts: [alert('a1', '005930')],
                firedPriceAlerts: [],
            });

            expect(getAssetInfoStatic).toHaveBeenCalledTimes(2);
            expect(
                screen.getByText(/^삼성전자 \(005930\) 종가가/)
            ).toBeVisible();
            expect(screen.getByText(/^엔비디아 \(NVDA\) 추세/)).toBeVisible();
        });
    });
});
