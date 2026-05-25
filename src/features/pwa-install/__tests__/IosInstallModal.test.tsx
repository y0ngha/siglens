import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IosInstallModal } from '@/features/pwa-install';

describe('IosInstallModal', () => {
    it('3단계 안내가 모두 렌더된다', () => {
        render(<IosInstallModal onClose={vi.fn()} />);
        expect(
            screen.getByText('Safari 하단 공유 버튼을 탭하세요')
        ).toBeInTheDocument();
        expect(
            screen.getByText("'홈 화면에 추가'를 선택하세요")
        ).toBeInTheDocument();
        expect(
            screen.getByText("우측 상단 '추가'를 탭하면 완료!")
        ).toBeInTheDocument();
    });

    it('닫기(×) 버튼 클릭 → onClose 호출', () => {
        const onClose = vi.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('backdrop 클릭 → onClose 호출', () => {
        const onClose = vi.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByTestId('ios-modal-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('모달 콘텐츠 클릭 → onClose 호출 안 됨 (이벤트 버블 차단)', () => {
        const onClose = vi.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByTestId('ios-modal-content'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape 키 → onClose 호출', () => {
        const onClose = vi.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('mount시 모달 내부의 첫 번째 focusable(닫기 버튼)에 포커스가 이동한다', () => {
        const trigger = document.createElement('button');
        trigger.setAttribute('data-testid', 'trigger');
        document.body.appendChild(trigger);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        render(<IosInstallModal onClose={vi.fn()} />);
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: '닫기' })
        );
        document.body.removeChild(trigger);
    });

    it('unmount시 trigger 요소로 포커스가 복원된다', () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const { unmount } = render(<IosInstallModal onClose={vi.fn()} />);
        // Sanity check: focus moved into modal.
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: '닫기' })
        );
        unmount();
        expect(document.activeElement).toBe(trigger);
        document.body.removeChild(trigger);
    });
});
