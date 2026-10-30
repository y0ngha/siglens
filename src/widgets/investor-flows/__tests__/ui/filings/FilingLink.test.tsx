// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { LargeHolderCard } from '../../../ui/large-holders/LargeHolderCard';
import { OfferingRow } from '../../../ui/dilution/OfferingRow';
import { ProposedSaleRecords } from '../../../ui/form144/ProposedSaleRecords';
import { TradeRecords } from '../../../ui/insider/TradeRecords';
import {
    makeLargeHolder,
    makeOffering,
    makeProposedSale,
    makeTransaction,
} from '../../fixtures/flowsFixtures';
import { DartFilingLink } from '../../../ui/filings/DartFilingLink';
import { FilingLink } from '../../../ui/filings/FilingLink';

describe('FilingLink', () => {
    it('눈에 보이는 글자와 별개로 공시를 가리키는 접근 가능한 이름을 가진다', () => {
        render(
            <FilingLink
                url="https://www.sec.gov/Archives/a.htm"
                label="공시 보기"
                accessibleName="Fixture Director A 공시 보기"
            />
        );
        const link = screen.getByRole('link', {
            name: 'Fixture Director A 공시 보기',
        });
        expect(link).toHaveTextContent('공시 보기');
        expect(link).toHaveAttribute(
            'href',
            'https://www.sec.gov/Archives/a.htm'
        );
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('같은 글자의 링크 둘이 이름으로 서로 구분된다', () => {
        render(
            <>
                <FilingLink
                    url="https://www.sec.gov/Archives/a.htm"
                    label="공시 보기"
                    accessibleName="A 공시 보기"
                />
                <FilingLink
                    url="https://www.sec.gov/Archives/b.htm"
                    label="공시 보기"
                    accessibleName="B 공시 보기"
                />
            </>
        );
        expect(screen.getByRole('link', { name: 'A 공시 보기' })).toBeVisible();
        expect(screen.getByRole('link', { name: 'B 공시 보기' })).toBeVisible();
    });

    it('안전한 http(s) 주소가 아니면 링크 대신 대시를 둔다', () => {
        render(
            <FilingLink
                url="javascript:alert(1)"
                label="공시 보기"
                accessibleName="A 공시 보기"
            />
        );
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('–')).toBeInTheDocument();
    });
});

describe('DartFilingLink', () => {
    it('보고자 이름을 링크 이름에 넣는다', () => {
        render(
            <DartFilingLink
                url="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1"
                reporter="국민연금공단"
            />
        );
        expect(
            screen.getByRole('link', { name: '국민연금공단 DART 원문' })
        ).toHaveTextContent('DART 원문');
    });
});

describe('호출부별 링크 접근 가능한 이름 (로케일)', () => {
    const URL = 'https://www.sec.gov/Archives/edgar/data/0/x-index.htm';

    function renderCallers(locale: 'en' | 'ja' | 'zh') {
        render(
            withLocale(
                <>
                    <ul>
                        <OfferingRow filing={makeOffering({ url: URL })} />
                        <LargeHolderCard
                            filing={makeLargeHolder({ url: URL })}
                        />
                    </ul>
                    <ProposedSaleRecords
                        sales={[makeProposedSale({ url: URL })]}
                    />
                    <TradeRecords
                        rows={[makeTransaction({ url: URL })]}
                        caption="caption"
                    />
                    <DartFilingLink url={URL} reporter="Fixture Reporter" />
                </>,
                locale
            )
        );
        return screen.getAllByRole('link');
    }

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 모든 호출부의 접근 가능한 이름이 보이는 글자를 포함한다',
        locale => {
            const links = renderCallers(locale);
            expect(links).toHaveLength(7);
            for (const link of links) {
                expect(link.getAttribute('aria-label')).toContain(
                    link.textContent
                );
            }
        }
    );

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 호출부마다 접근 가능한 이름이 서로 다르다',
        locale => {
            const links = renderCallers(locale);
            // 카드·표 두 표현이 같은 이름을 갖는 호출부(Form 144, 내부자 거래)는 한 이름으로 센다.
            const names = new Set(
                links.map(link => link.getAttribute('aria-label'))
            );
            expect(names.size).toBe(5);
        }
    );
});
