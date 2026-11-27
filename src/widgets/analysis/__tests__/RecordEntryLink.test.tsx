import { render, screen } from '@testing-library/react';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import en from '../../../../messages/en.json';
import ko from '../../../../messages/ko.json';
import { RecordEntryLink } from '../RecordEntryLink';

describe('RecordEntryLink', () => {
    it('백테스트 페이지의 기록 구역으로 가는 링크다', () => {
        renderWithIntl(<RecordEntryLink />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/backtesting#record');
        expect(link).toHaveTextContent(
            ko.widgets.analysis.RecordEntryLink.entry
        );
        expect(link).toHaveTextContent('분석 기록과 측정 방법');
    });

    it('기본 로케일이 아니면 경로에 로케일 접두사가 붙고 문구도 번역된다', () => {
        render(withLocale(<RecordEntryLink />, 'en'));

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/en/backtesting#record');
        expect(link).toHaveTextContent(
            en.widgets.analysis.RecordEntryLink.entry
        );
    });
});
