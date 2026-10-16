import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DilutionRiskBadge } from '@/views/symbol/DilutionRiskBadge';

const NOTE = '최근 SEC 공시 기준이며, 실제 매도 규모는 공시로 알 수 없어요.';

describe('DilutionRiskBadge', () => {
    it('ATM: 문구·MM/DD 신고일을 보이고 수급 탭 증자·희석 섹션으로 잇는다', () => {
        render(
            <DilutionRiskBadge
                symbol="AAPL"
                event={{ kind: 'atm', filingDate: '2026-10-09' }}
            />
        );
        const link = screen.getByRole('link', {
            name: '증자·희석: 최근 ATM(시장가 상시 발행) 공시 · 10/09',
        });
        expect(link).toHaveAttribute(
            'href',
            '/AAPL/flows#flows-dilution-heading'
        );
        expect(link).toHaveAttribute('title', NOTE);
        expect(link).toHaveAccessibleDescription(NOTE);
    });

    it('좁은 화면에서는 문구만 말줄임되고 신고일은 따로 그려 항상 보인다', () => {
        render(
            <DilutionRiskBadge
                symbol="AAPL"
                event={{ kind: 'atm', filingDate: '2026-10-04' }}
            />
        );
        const link = screen.getByRole('link');
        const label = within(link).getByText(
            '증자·희석: 최근 ATM(시장가 상시 발행) 공시'
        );
        const date = within(link).getByText('· 10/04');
        expect(label).toHaveClass('truncate');
        expect(date).not.toHaveClass('truncate');
        expect(date).toHaveClass('shrink-0');
        expect(label).not.toContainElement(date);
    });

    it('가격이 정해진 공모: 공모 발행 문구', () => {
        render(
            <DilutionRiskBadge
                symbol="SOFI"
                event={{ kind: 'priced', filingDate: '2026-09-25' }}
            />
        );
        expect(
            screen.getByRole('link', {
                name: '증자·희석: 최근 공모 발행 공시 · 09/25',
            })
        ).toHaveAttribute('href', '/SOFI/flows#flows-dilution-heading');
    });
});
