/**
 * 공시 원문 링크(새 탭) — 표·목록에서 여러 번 나오는 같은 글자의 링크를 스크린리더가 구분하게 이름을 따로 받는다.
 */
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface FilingLinkProps {
    readonly url: string;
    /** 눈에 보이는 링크 글자("원문 보기"). */
    readonly label: string;
    /** 접근 가능한 이름 — 보고자·양식·날짜처럼 이 링크가 가리키는 공시를 밝힌다(WCAG 2.4.4). */
    readonly accessibleName: string;
}

/** 안전한 http(s) 주소가 아니면 링크 대신 대시를 둔다. */
export function FilingLink({ url, label, accessibleName }: FilingLinkProps) {
    const href = toSafeHttpUrl(url);
    if (href === null) {
        return <span className="text-xs text-secondary-400">–</span>;
    }
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={accessibleName}
            className={LINK_CLASS}
        >
            {label}
        </a>
    );
}
