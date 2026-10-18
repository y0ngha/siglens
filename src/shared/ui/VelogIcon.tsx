interface VelogIconProps {
    className?: string;
}

/**
 * velog 표시 — 둥근 사각형 안의 `V`. `GithubIcon`·`XIcon`과 같이 **채움(fill)** 단색이고
 * `V`는 사각형을 비워(evenodd) 그린다. 공식 로고 경로를 옮겨 오지 않고 같은 모양(둥근
 * 사각형 + V)을 단순한 도형으로 그렸다.
 *
 * `currentColor`라 색은 부모가 정한다. 장식이라 `aria-hidden`이고, 접근 가능한 이름은
 * 감싸는 링크의 `aria-label`이 진다.
 */
export function VelogIcon({ className = 'h-5 w-5' }: VelogIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            fillRule="evenodd"
            className={className}
            aria-hidden="true"
        >
            <path d="M6 2h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm1.2 5.5 3.6 10h2.4l3.6-10h-2.3L12 14.2 9.5 7.5z" />
        </svg>
    );
}
