import { render, screen } from '@testing-library/react';
import { PeersTable } from '@/widgets/fundamental/sections/PeersTable';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';
import { koMessage } from '@/shared/test-utils/koMessage';

const SAMPLE_PEERS: FundamentalPeerInput[] = [
    {
        symbol: 'MSFT',
        companyName: 'Microsoft Corp.',
        marketCap: 3_000_000_000_000,
    },
    {
        symbol: 'GOOGL',
        companyName: 'Alphabet Inc.',
        marketCap: 2_000_000_000_000,
    },
];

describe('PeersTable', () => {
    it('renders peer rows when peers provided', () => {
        render(<PeersTable peers={SAMPLE_PEERS} />);
        expect(
            screen.getByRole('heading', { name: '동종업계 비교' })
        ).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument();
    });

    it('renders empty state heading when peers is empty array', () => {
        render(<PeersTable peers={[]} />);
        expect(
            screen.getByRole('heading', { name: '동종업계 비교' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                koMessage('widgets.financials.section.emptySection')
            )
        ).toBeInTheDocument();
    });

    it('큐레이션 peer는 색인되는 차트 /{peer}로 링크한다 (항상-noindex 펀더멘털 탭이 아니라)', () => {
        render(<PeersTable peers={SAMPLE_PEERS} />);
        expect(screen.getByText('MSFT').closest('a')).toHaveAttribute(
            'href',
            '/MSFT'
        );
        expect(screen.getByText('GOOGL').closest('a')).toHaveAttribute(
            'href',
            '/GOOGL'
        );
    });

    it('큐레이션 밖 peer는 링크 없는 텍스트다 (noindex 롱테일로 크롤 예산을 쓰지 않는다)', () => {
        render(
            <PeersTable
                peers={[
                    {
                        symbol: 'ZZZNOTREAL',
                        companyName: 'Unlisted Co.',
                        marketCap: 1_000_000,
                    },
                ]}
            />
        );
        const cell = screen.getByText('ZZZNOTREAL');
        expect(cell.closest('a')).toBeNull();
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
});
