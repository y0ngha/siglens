/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/components/fundamental/sections/EmptySectionCard';
import { PeersTable } from '@/components/fundamental/sections/PeersTable';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';

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
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });
});
