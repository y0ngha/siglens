/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IosInstallModal } from '@/components/pwa/IosInstallModal';

describe('IosInstallModal', () => {
    it('3단계 안내가 모두 렌더된다', () => {
        render(<IosInstallModal onClose={jest.fn()} />);
        expect(
            screen.getByText('Safari 하단 공유 버튼을 탭하세요'),
        ).toBeInTheDocument();
        expect(
            screen.getByText("'홈 화면에 추가'를 선택하세요"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("우측 상단 '추가'를 탭하면 완료!"),
        ).toBeInTheDocument();
    });

    it('닫기(×) 버튼 클릭 → onClose 호출', () => {
        const onClose = jest.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('backdrop 클릭 → onClose 호출', () => {
        const onClose = jest.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByTestId('ios-modal-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('모달 콘텐츠 클릭 → onClose 호출 안 됨 (이벤트 버블 차단)', () => {
        const onClose = jest.fn();
        render(<IosInstallModal onClose={onClose} />);
        fireEvent.click(screen.getByTestId('ios-modal-content'));
        expect(onClose).not.toHaveBeenCalled();
    });
});
