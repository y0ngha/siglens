import { render, screen } from '@testing-library/react';
import { ApiKeyStatusMessage } from '@/features/api-key-management/ui/ApiKeyStatusMessage';

describe('ApiKeyStatusMessage', () => {
    it('renders an empty polite status region while idle', () => {
        render(
            <ApiKeyStatusMessage
                id="status"
                state={{ status: 'idle', message: null }}
            />
        );
        const region = screen.getByRole('status');
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toBeEmptyDOMElement();
    });

    it('renders a success message in the success tone', () => {
        render(
            <ApiKeyStatusMessage
                id="status"
                state={{ status: 'success', message: '저장됨' }}
            />
        );
        expect(screen.getByText('저장됨')).toHaveClass('text-ui-success-text');
    });

    it('renders an error message in the danger tone', () => {
        render(
            <ApiKeyStatusMessage
                id="status"
                state={{ status: 'error', message: '실패', code: 'unknown' }}
            />
        );
        expect(screen.getByText('실패')).toHaveClass('text-ui-danger-text');
    });

    it('exposes the id that inputs reference with aria-describedby', () => {
        render(
            <ApiKeyStatusMessage
                id="api-key-save-status-openai"
                state={{ status: 'idle', message: null }}
            />
        );
        expect(screen.getByRole('status')).toHaveAttribute(
            'id',
            'api-key-save-status-openai'
        );
    });
});
