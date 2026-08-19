// @vitest-environment jsdom
/**
 * `ChatPanel`이 **정말로 지연 로드되는지** 고정한다.
 *
 * 이 버튼은 `/[symbol]` 레이아웃에 항상 마운트되므로, 정적 import로 되돌아가면
 * 챗을 한 번도 열지 않는 방문자까지 `ChatPanel`과 그 의존인 마크다운 렌더러
 * (react-markdown 체인, 청크 114KB)를 받는다. 그런데 `dynamic()`을 정적 import로
 * 바꾸는 뮤테이션은 기존 테스트를 하나도 깨지 않았다 — import 정리 한 번이면
 * 조용히 되돌아간다.
 *
 * **왜 렌더 결과로는 못 잡는가**: RTL의 `act()`가 `render()` 안에서 lazy 해석을
 * 함께 flush해 버려서, 자리표(`role="status"`)는 DOM에 들어온 적이 없고 본문도
 * 제목과 같은 틱에 도착한다. 유일하게 동작하는 신호는 **모듈이 평가됐는가**다.
 *
 * **왜 파일 하나에 테스트 하나인가**: 모듈 레지스트리는 파일 단위로만 초기화된다.
 * 같은 파일에서 패널을 한 번이라도 연 테스트가 앞서 돌면 이 단언은 그 뒤로 영영
 * 무의미해진다.
 */
import { render } from '@testing-library/react';

const loaded = vi.hoisted(() => ({ chatPanel: 0 }));

vi.mock('../ChatPanel', () => {
    loaded.chatPanel += 1;
    return { ChatPanel: () => <div data-testid="chat-panel" /> };
});
vi.mock('@/features/symbol-chat', () => ({
    useSymbolChat: vi.fn(() => ({ isAnalysisReady: false })),
}));
vi.mock('../hooks/useChatButtonState', () => ({
    useChatButtonState: vi.fn(() => ({
        isOpen: false,
        showTooltip: false,
        handleClose: vi.fn(),
        handleButtonClick: vi.fn(),
        dismissTooltip: vi.fn(),
    })),
}));

import { FloatingChatButton } from '../FloatingChatButton';

it('챗을 열지 않은 방문자는 ChatPanel 청크를 받지 않는다', () => {
    render(<FloatingChatButton symbol="AAPL" />);
    // 정적 import로 되돌리면 모듈이 import 시점에 평가돼 1이 된다.
    expect(loaded.chatPanel).toBe(0);
});
