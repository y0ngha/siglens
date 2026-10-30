import { render } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { MarketFearGreedEmptyState } from '@/widgets/market-fear-greed/ui/empty/MarketFearGreedEmptyState';

describe('MarketFearGreedEmptyState', () => {
    it('renders the insufficient-data message', () => {
        const { getByText } = render(<MarketFearGreedEmptyState />);
        expect(
            getByText('시장 공포 탐욕 지수를 계산할 데이터가 부족합니다.')
        ).toBeInTheDocument();
    });

    it('renders no gauge', () => {
        const { container } = render(<MarketFearGreedEmptyState />);
        expect(container.querySelector('svg')).toBeNull();
    });

    /*
     * 브라우저는 문장 속 줄바꿈과 들여쓰기를 공백 한 칸으로 접는다. 한글은
     * 띄어쓰기라 티가 안 나지만 일본어·중국어는 단어 사이에 공백을 두지 않아
     * 문장 한가운데에 빈칸이 보인다.
     */
    it.each([
        [
            'ko',
            '데이터가 아직 충분히 쌓이지 않았을 수 있습니다. 잠시 후 다시 확인해주세요.',
        ],
        [
            'ja',
            'データがまだ十分に蓄積されていない可能性があります。しばらくしてから再度ご確認ください。',
        ],
        ['zh', '数据可能尚未充分积累。请稍后再次查看。'],
    ] as const)(
        'renders the %s retry hint as one unbroken sentence',
        (locale, text) => {
            const { getByText } = renderWithIntl(
                <MarketFearGreedEmptyState />,
                {
                    locale,
                }
            );
            expect(getByText(text).textContent).toBe(text);
        }
    );
});
