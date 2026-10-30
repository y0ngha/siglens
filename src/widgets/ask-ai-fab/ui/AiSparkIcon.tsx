/**
 * Ask-AI FAB의 AI 스파클 아이콘(큰 다이아몬드 + 작은 다이아몬드, fill 스타일).
 */

/**
 * 장식용 AI 스파클 아이콘. 링크 이름은 옆 텍스트가 맡으므로 `aria-hidden`이다.
 *
 * 별 모양은 "즐겨찾기"로 읽히므로 AI를 뜻하는 스파클을 쓴다. `@/widgets/agent-chat`의
 * `SparkIcon`과 같은 모양이지만 위젯 간 import가 금지라 경로 두 개를 여기 둔다.
 */
export function AiSparkIcon() {
    return (
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
    );
}
