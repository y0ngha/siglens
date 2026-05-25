import { render } from '@testing-library/react';
import NewsLoading from '@/app/[symbol]/news/loading';

describe('NewsLoading', () => {
    it('renders skeleton placeholder blocks', () => {
        const { container } = render(<NewsLoading />);

        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBe(5);
    });

    it('marks skeleton blocks as aria-hidden', () => {
        const { container } = render(<NewsLoading />);

        const hiddenBlocks = container.querySelectorAll('[aria-hidden="true"]');
        expect(hiddenBlocks.length).toBe(5);
    });
});
