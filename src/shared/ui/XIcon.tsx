interface XIconProps {
    className?: string;
}

/**
 * X(구 트위터) 마크. `GithubIcon`과 같은 이유로 **채움(fill)** 이다 — 브랜드
 * 마크는 하우스 스타일(아웃라인 스트로크)에 맞추지 않고 공식 단색 실루엣을 쓴다.
 *
 * `currentColor`를 쓰므로 색은 부모가 정한다. 링크 텍스트와 같은 램프를 쓰면
 * hover 전이와 두 테마 대비가 자동으로 따라온다. 장식이라 `aria-hidden`이고,
 * 접근 가능한 이름은 감싸는 링크의 `aria-label`이 진다.
 */
export function XIcon({ className = 'h-5 w-5' }: XIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}
