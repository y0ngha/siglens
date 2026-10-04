import { render, screen } from '@testing-library/react';
import { MarkdownText } from '@/shared/ui/MarkdownText';

/**
 * 격리 레인에 따로 둔다. 지연 로드된 렌더러는 모듈 단위로 한 번 풀리면 계속 풀린 채라,
 * 다른 테스트와 같은 모듈 레지스트리를 쓰면 이 "도착 전" 상태를 볼 수 없다.
 */
describe('MarkdownText — 렌더러 도착 전', () => {
    /**
     * 빈칸이면 렌더러가 도착할 때 아래 내용이 밀린다(CLS). 마커만 걷어낸 같은 글자를 보여 준다.
     */
    it('같은 글자를 마커 없이 보여 준다', () => {
        render(<MarkdownText>{'**굵게** 그리고 `코드`'}</MarkdownText>);
        expect(screen.getByText('굵게 그리고 코드')).toBeInTheDocument();
    });
});
