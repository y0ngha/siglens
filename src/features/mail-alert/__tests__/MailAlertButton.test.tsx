const launched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: () => launched.value,
    })
);
/**
 * 지연 로드되는 대화상자는 여기서 가짜로 바꾼다 — `next/dynamic`이 첫 렌더 때 모듈을 내려받는 시간에 따라
 * 테스트가 갈리지(느린 CI에서 `findByRole` 타임아웃) 않게 한다. 대화상자 자체는 `MailAlertDialog.test.tsx`가 본다.
 */
vi.mock('@/features/mail-alert/ui/MailAlertDialog', () => ({
    MailAlertDialog: ({
        title,
        onClose,
    }: {
        title: string;
        onClose: () => void;
    }) => (
        <div role="dialog" aria-label={title}>
            <button type="button" onClick={onClose}>
                닫기
            </button>
        </div>
    ),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MailAlertButton } from '@/features/mail-alert/ui/MailAlertButton';
import { LOCALES } from '@/shared/i18n/locales';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import en from '../../../../messages/en.json';
import ja from '../../../../messages/ja.json';
import ko from '../../../../messages/ko.json';
import zh from '../../../../messages/zh.json';

const TOPIC = { kind: 'symbol', symbol: 'AAPL' } as const;
const LABELS = {
    ko: ko.features['mail-alert'].button,
    en: en.features['mail-alert'].button,
    ja: ja.features['mail-alert'].button,
    zh: zh.features['mail-alert'].button,
} as const;

beforeEach(() => {
    launched.value = true;
});

describe('MailAlertButton', () => {
    it('공개 전에는 아무것도 그리지 않는다', () => {
        launched.value = false;
        const { container } = render(
            <MailAlertButton topic={TOPIC} name="애플" />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('아이콘만 있는 size-11 버튼이고 이름은 aria-label이다(보이는 글자가 없다)', () => {
        render(<MailAlertButton topic={TOPIC} name="애플" />);

        const button = screen.getByRole('button', { name: '메일로 받기' });
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button.className).toContain('size-11');
        expect(button).toHaveTextContent('');
    });

    it.each(LOCALES)(
        '%s에서도 폭이 같다: 같은 클래스, 글자 없음, 로케일별 접근 가능한 이름',
        locale => {
            const { container } = renderWithIntl(
                <MailAlertButton topic={TOPIC} name="Apple" />,
                { locale }
            );

            const button = screen.getByRole('button', { name: LABELS[locale] });
            expect(button).toHaveTextContent('');
            expect(container.querySelector('button')?.className).toBe(
                'inline-flex size-11 touch-manipulation items-center justify-center rounded-lg border border-border-control text-secondary-300 transition-colors hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
            );
        }
    );

    it('누르면 대화상자(종목 표시명이 든 제목)가 열리고 닫으면 사라진다', async () => {
        const user = userEvent.setup();
        render(<MailAlertButton topic={TOPIC} name="애플" />);

        await user.click(screen.getByRole('button', { name: '메일로 받기' }));

        expect(
            await screen.findByRole('dialog', {
                name: '애플의 추세 판정이 바뀌거나 주요 신호가 새로 잡히면 메일로 알려 드려요',
            })
        ).toBeInTheDocument();
        await user.click(await screen.findByRole('button', { name: '닫기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
