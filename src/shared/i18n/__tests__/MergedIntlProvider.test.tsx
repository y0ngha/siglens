import { screen } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderWithoutIntl } from '@/shared/test-utils/renderWithoutIntl';
import { MergedIntlProvider } from '../MergedIntlProvider';

function Probe() {
    const tChrome = useTranslations('chrome');
    const tRoute = useTranslations('route');
    return (
        <p data-testid="probe">
            {tChrome('title')}|{tRoute('heading')}
        </p>
    );
}

describe('MergedIntlProvider', () => {
    it('부모 프로바이더의 메시지를 잃지 않고 차이를 덧붙인다', () => {
        renderWithoutIntl(
            <NextIntlClientProvider
                locale="ko"
                messages={{ chrome: { title: '크롬' } }}
            >
                <MergedIntlProvider
                    locale="ko"
                    messages={{ route: { heading: '라우트' } }}
                >
                    <Probe />
                </MergedIntlProvider>
            </NextIntlClientProvider>
        );

        expect(screen.getByTestId('probe').textContent).toBe('크롬|라우트');
    });

    it('중첩해도 위의 모든 프로바이더 메시지가 남는다(탭 → [symbol] → 크롬)', () => {
        function DeepProbe() {
            const t = useTranslations();
            return (
                <p data-testid="deep">
                    {t('chrome.title')}|{t('symbol.name')}|{t('tab.heading')}
                </p>
            );
        }
        renderWithoutIntl(
            <NextIntlClientProvider
                locale="ko"
                messages={{ chrome: { title: '크롬' } }}
            >
                <MergedIntlProvider
                    locale="ko"
                    messages={{ symbol: { name: '종목' } }}
                >
                    <MergedIntlProvider
                        locale="ko"
                        messages={{ tab: { heading: '탭' } }}
                    >
                        <DeepProbe />
                    </MergedIntlProvider>
                </MergedIntlProvider>
            </NextIntlClientProvider>
        );

        expect(screen.getByTestId('deep').textContent).toBe('크롬|종목|탭');
    });
});
