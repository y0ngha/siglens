/**
 * `AskAiInlineLink` 렌더 계약 — 링크 대상(href)·새 탭 속성·식별 속성·접근성 이름.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AskAiInlineLink } from '../ui/AskAiInlineLink';
import { aiAskUrl } from '@/shared/config/aiHost';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

describe('AskAiInlineLink', () => {
    it('href가 aiAskUrl(localePrefix, question)과 같다 — 질문에 종목명이 들어간다', () => {
        render(<AskAiInlineLink name="애플" localePrefix="/" />);

        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            aiAskUrl('/', '애플 지금 어떤 상황인지 종합적으로 알려줘')
        );
    });

    it('비기본 로케일에서는 접두 경로와 영어 질문이 href에 실린다', () => {
        renderWithIntl(<AskAiInlineLink name="Apple" localePrefix="/en" />, {
            locale: 'en',
        });

        const question = catalogTranslator('widgets.ask-ai-fab', 'en')(
            'question',
            { name: 'Apple' }
        );
        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            aiAskUrl('/en', question)
        );
    });

    it('새 탭으로 열리고 nofollow noopener이며 인라인 표식을 단다', () => {
        render(<AskAiInlineLink name="애플" localePrefix="/" />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'nofollow noopener');
        expect(link).toHaveAttribute('data-ask-ai-inline');
        // 떠 있는 버튼의 표식은 달지 않는다 — 달면 CSS가 자기 자신을 숨기고 배너도 막는다.
        expect(link).not.toHaveAttribute('data-ask-ai-fab');
    });

    it('접근성 이름에 보이는 라벨과 새 탭 안내가 들어가고 aria-label로 덮지 않는다', () => {
        render(<AskAiInlineLink name="애플" localePrefix="/" />);

        const link = screen.getByRole('link');
        expect(link).not.toHaveAttribute('aria-label');
        expect(link).toHaveAccessibleName(/시그렌즈 AI에게 물어보기/);
        expect(link).toHaveAccessibleName(/\(새 탭\)$/);
        expect(screen.getByText('(새 탭)')).toHaveClass('sr-only');
    });

    it('고정 높이(min-h-11)와 포커스 링을 가진다', () => {
        render(<AskAiInlineLink name="애플" localePrefix="/" />);

        expect(screen.getByRole('link')).toHaveClass(
            'min-h-11',
            'focus-visible:ring-2',
            'focus-visible:ring-primary-500'
        );
    });
});
