import { render, screen } from '@testing-library/react';
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
