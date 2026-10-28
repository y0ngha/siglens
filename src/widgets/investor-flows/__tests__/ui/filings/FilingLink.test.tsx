// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
