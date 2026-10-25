import { screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import koMessages from '../../../../messages/ko.json';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { OptionsStaleDataBanner } from '@/widgets/options/OptionsStaleDataBanner';

vi.mock('@/shared/lib/options/marketHoursDisplay', () => ({
    ET_MARKET_HOURS_DISPLAY: '9:30~16:00 ET',
    KST_EDT_HOURS_DISPLAY: '22:30~05:00',
    KST_EST_HOURS_DISPLAY: '23:30~06:00',
}));

vi.mock('@/shared/lib/eastern', () => ({
    EDT_OFFSET_HOURS: -4,
    getEasternOffsetHours: () => -4,
}));

/** 서버 렌더(= 하이드레이션 렌더가 맞춰야 하는 HTML)를 텍스트로 돌려준다. */
function renderServerText(): string {
    const html = renderToString(
        <NextIntlClientProvider locale="ko" messages={koMessages}>
            <OptionsStaleDataBanner />
        </NextIntlClientProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.textContent ?? '';
}

describe('OptionsStaleDataBanner', () => {
    it('renders the stale data heading', () => {
        renderWithIntl(<OptionsStaleDataBanner />);
        expect(
            screen.getByText('옵션 OI 데이터가 비어 있어요')
        ).toBeInTheDocument();
    });

    it('renders status role', () => {
        renderWithIntl(<OptionsStaleDataBanner />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('이유는 한 문장만 말하고 정규장 시간·KST 환산 문단은 싣지 않는다', () => {
        renderWithIntl(<OptionsStaleDataBanner />);
        const paragraphs = screen.getByRole('status').querySelectorAll('p');
        // 제목 + 이유 한 문장 + "지금은 …" 문장.
        expect(paragraphs).toHaveLength(3);
        const text = screen.getByRole('status').textContent ?? '';
        expect(text).not.toContain('9:30~16:00 ET');
        expect(text).not.toContain('조기 마감일');
    });

    it('지금 확인할 KST 시간대만 안내한다(현재 서머타임 기준)', () => {
        renderWithIntl(<OptionsStaleDataBanner />);
        const text = screen.getByRole('status').textContent ?? '';
        expect(text).toContain('22:30~05:00');
        expect(text).not.toContain('23:30~06:00');
    });

    describe('서버 렌더(하이드레이션 렌더와 같은 HTML)', () => {
        it('지금은 DST 문장이 렌더되지 않는다', () => {
            expect(renderServerText()).not.toContain('지금은');
        });

        it('정적 단락(미국 정규장 마감 후)은 여전히 렌더된다', () => {
            expect(renderServerText()).toMatch(
                /미국 정규장 마감 후에는 Yahoo가/
            );
        });
    });

    describe('클라이언트 렌더(마운트 후)', () => {
        it('지금은 ... 기간이니 DST 문장이 렌더된다', () => {
            renderWithIntl(<OptionsStaleDataBanner />);
            // getEasternOffsetHours가 -4(EDT_OFFSET_HOURS)를 반환하므로 서머타임(EDT)
            expect(
                screen.getByText(/지금은 서머타임\(EDT\) 기간이니/)
            ).toBeInTheDocument();
        });
    });
});
