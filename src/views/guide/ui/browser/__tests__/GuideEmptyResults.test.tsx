import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { aiAskUrl } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { GuideEmptyResults } from '@/views/guide/ui/browser/GuideEmptyResults';

let t: Awaited<ReturnType<typeof getTranslations<'views.guide'>>>;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'views.guide' });
});

describe('GuideEmptyResults', () => {
    it('앞뒤 공백을 지운 질의를 AI 질문 문구에 싣는다', () => {
        renderWithIntl(
            <GuideEmptyResults query="  RSI 다이버전스  " onReset={vi.fn()} />
        );

        expect(
            screen.getByRole('link', { name: t('emptyAskAi') })
        ).toHaveAttribute(
            'href',
            aiAskUrl(
                localePath('ko', '/'),
                t('emptyAiQuestion', { query: 'RSI 다이버전스' })
            )
        );
    });

    it('AI 링크는 새 탭으로 열고 크롤러가 따라가지 않게 한다', () => {
        renderWithIntl(<GuideEmptyResults query="RSI" onReset={vi.fn()} />);

        const link = screen.getByRole('link', { name: t('emptyAskAi') });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'nofollow noopener noreferrer');
    });

    it('필터 지우기 버튼은 onReset을 부른다', async () => {
        const onReset = vi.fn();
        renderWithIntl(<GuideEmptyResults query="RSI" onReset={onReset} />);

        await userEvent.click(
            screen.getByRole('button', { name: t('emptyReset') })
        );

        expect(onReset).toHaveBeenCalledOnce();
    });
});
