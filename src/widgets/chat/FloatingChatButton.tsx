'use client';

import dynamic from 'next/dynamic';
import { useChatButtonState } from './hooks/useChatButtonState';
import { useSymbolChat } from '@/features/symbol-chat';

/**
 * 챗 패널은 **열었을 때** 내려받는다.
 *
 * 이 버튼은 `/[symbol]` 레이아웃에 항상 마운트되므로, 정적 import이던 시절에는
 * 챗을 한 번도 열지 않는 방문자까지 `ChatPanel`과 그 의존인 마크다운 렌더러
 * (`react-markdown` 체인, 청크 114KB)를 받았다. 아래 렌더는 이미 `isOpen && ...`
 * 조건부라, 지연 로드로 바꾸면 실제로 여는 사용자만 비용을 낸다.
 *
 * 다만 **마크다운 청크가 모든 종목 탭에서 사라지는 것은 아니다**: `/[symbol]`은
 * `ChartContent → AnalysisPanel`이, `/[symbol]/overall`은 `widgets/overall/sections/*`가
 * `MarkdownText`를 그대로 정적 import한다(둘 다 AI 서사를 즉시 그려야 해서 지연시킬
 * 이유가 없다). 이 변경이 실제로 청크를 걷어내는 곳은 `news`·`fundamental`·`options`
 * 처럼 마크다운을 쓰지 않는 탭들이고, 홈에서 걷어낸 것은 짝을 이루는
 * `NoticePopup` 쪽 변경이다.
 *
 * `ssr: false`인 이유: 패널은 열린 상태로 서버 렌더될 일이 없다(초기값이 닫힘).
 * `loading` 자리표는 패널 껍데기(`fixed` 오버레이) **안쪽**에만 들어가므로
 * 문서 흐름을 밀지 않는다 — 레이아웃 이동 없이 "여는 중"만 보인다.
 */
const ChatPanel = dynamic(() => import('./ChatPanel').then(m => m.ChatPanel), {
    ssr: false,
    loading: () => (
        <div
            className="flex h-64 items-center justify-center text-xs text-secondary-400"
            role="status"
            aria-live="polite"
        >
            채팅을 여는 중…
        </div>
    ),
});

interface FloatingChatButtonProps {
    symbol: string;
}

export function FloatingChatButton({ symbol }: FloatingChatButtonProps) {
    const { isAnalysisReady } = useSymbolChat();
    const {
        isOpen,
        showTooltip,
        handleClose,
        handleButtonClick,
        dismissTooltip,
    } = useChatButtonState(isAnalysisReady);

    return (
        <>
            {isOpen && (
                <div className="fixed inset-x-2 bottom-18 z-60 rounded-lg border border-secondary-700 bg-secondary-900 shadow-2xl md:inset-x-auto md:right-6 md:bottom-20 md:w-95">
                    <ChatPanel symbol={symbol} onClose={handleClose} />
                </div>
            )}
            {showTooltip && !isOpen && (
                <div className="fixed right-4 bottom-18 z-60 w-64 rounded-lg border border-secondary-700 bg-secondary-800 px-4 py-3 shadow-xl md:right-6 md:bottom-22">
                    <button
                        type="button"
                        onClick={dismissTooltip}
                        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-xs text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        aria-label="툴팁 닫기"
                    >
                        ✕
                    </button>
                    <p className="pr-4 text-sm leading-relaxed text-secondary-100">
                        분석 내용에 궁금하신 게 있다면 언제든 저에게
                        말씀해주세요.
                    </p>
                </div>
            )}
            <button
                type="button"
                onClick={handleButtonClick}
                className="fixed right-4 bottom-3 z-60 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none md:right-6 md:bottom-6"
                aria-label={isOpen ? 'AI 채팅 닫기' : 'AI 채팅 열기'}
                aria-expanded={isOpen}
            >
                <span className="text-base leading-none">
                    {isOpen ? '✕' : '💬'}
                </span>
            </button>
        </>
    );
}
