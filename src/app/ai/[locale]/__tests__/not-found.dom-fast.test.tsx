import { render, screen } from '@testing-library/react';
import AiNotFound, { generateMetadata } from '../not-found';
import { koMessage } from '@/shared/test-utils/koMessage';

describe('AiNotFound', () => {
    it('404 안내 문구를 보여준다', () => {
        render(<AiNotFound />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            koMessage('app.ai.not-found.047c35')
        );
    });

    it('홈으로 돌아가는 링크를 보여준다', () => {
        render(<AiNotFound />);

        const link = screen.getByRole('link', {
            name: koMessage('app.ai.not-found.04598e'),
        });
        expect(link).toHaveAttribute('href', '/');
    });

    it.each([
        ['ko', '대화를 찾을 수 없습니다'],
        ['en', 'Conversation not found'],
    ])(
        '%s: 제목이 로케일을 따르고 noindex다 — 레이아웃의 제품명 제목을 상속하지 않는다',
        async (locale, expected) => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale }),
            });

            expect(metadata.title).toBe(expected);
            expect(metadata.robots).toEqual({ index: false, follow: false });
        }
    );

    it('지원하지 않는 로케일은 한국어 제목으로 떨어진다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'xx' }),
        });

        expect(metadata.title).toBe(koMessage('app.ai.not-found.047c35'));
    });
});
