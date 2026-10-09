import { getTranslations } from 'next-intl/server';
import { aiAskUrl } from '@/shared/config/aiHost';

/**
 * 프리필 질문의 출처 — 둘 중 하나만 준다.
 *  - `name`: 종목 표시명. 종목 페이지의 "지금 어떤 상황인지" 질문에 끼워 넣는다.
 *  - `question`: 완성된 질문 문장. 호출부가 이미 로케일에 맞게 만든 것을 그대로 쓴다
 *    (차트 가이드 항목: "가이드: {제목} — …").
 */
type AskAiFabSource =
    | { name: string; question?: never }
    | { question: string; name?: never };

type AskAiFabProps = AskAiFabSource & {
    /** `aiAskUrl`에 넘길 로케일 접두 경로(`localePath(locale, '/')`). */
    localePrefix: string;
};

/**
 * `/[symbol]/*` 오른쪽 아래에 상주하던 자체 챗봇 플로팅 버튼의 후임.
 *
 * 패널을 열지 않는다 — 누르면 `ai.siglens.io`로 종목명이 미리 채워진 질문과
 * 함께 새 탭에서 이동한다(`aiAskUrl` 계약: 질문은 채워질 뿐 자동 전송되지
 * 않는다). 상호작용이 없는 순수 링크라 `'use client'`가 필요 없다 — 예전
 * `FloatingChatButton`은 패널 개폐 상태(`useChatButtonState`) 때문에 클라이언트
 * 컴포넌트였지만, 이 컴포넌트는 그 상태 자체가 없다.
 *
 * 위치·z-index는 `FloatingChatButton`을 그대로 물려받는다 — `SearchOverlay`의
 * `z-70`(오버레이가 이 FAB 위에 뜨게 하는 값)과 `NoticePopup`의 형제 주석이
 * 이 자리를 전제로 하므로 임의로 바꾸면 안 된다.
 */
export async function AskAiFab({
    name,
    question,
    localePrefix,
}: AskAiFabProps) {
    const t = await getTranslations('widgets.ask-ai-fab');
    const prefill = question ?? t('question', { name: name ?? '' });
    const href = aiAskUrl(localePrefix, prefill);

    return (
        <a
            href={href}
            target="_blank"
            // nofollow: 종목마다 질문 문구가 다른 `ai.siglens.io/?q=…` URL이 수천 개 생긴다.
            // 크롤러가 따라가면 색인 가치 없는 쿼리 URL에 크롤 예산을 쓴다.
            rel="nofollow noopener"
            aria-label={t('ariaLabel')}
            // 모바일 분석 시트가 HALF/FULL로 펼쳐지면 globals.css가 이 속성으로
            // 버튼을 숨긴다(`MobileAnalysisSheet`의 data-sheet-expanded 참고).
            data-ask-ai-fab
            className="fixed right-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-60 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none md:right-6 md:bottom-6"
        >
            {/* 별 아이콘은 "즐겨찾기"로 오독된다 — AI 스파클(두 개의 다이아몬드)로
                교체. `@/widgets/agent-chat`의 `SparkIcon`과 같은 모양을 fill
                스타일로 로컬 복제했다(경로 문자열 두 개뿐이라 그 barrel을 import해
                ChatShell까지 모듈 그래프에 끌어들일 이유가 없다). */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 shrink-0"
                aria-hidden
            >
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
                <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
            </svg>
            <span className="sm:hidden">{t('shortLabel')}</span>
            <span className="hidden sm:inline">{t('label')}</span>
        </a>
    );
}
