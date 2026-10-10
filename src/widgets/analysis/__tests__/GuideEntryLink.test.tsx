import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../messages/ko.json';
import { GuideEntryLink } from '../GuideEntryLink';

describe('GuideEntryLink', () => {
    it('차트 가이드 허브로 가는 한 줄 링크다', () => {
        renderWithIntl(<GuideEntryLink />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/guide');
        expect(link).toHaveTextContent(ko.widgets.analysis.GuideHintLink.entry);
    });
});
