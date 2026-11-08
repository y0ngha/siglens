import { INQUIRY_HONEYPOT_FIELD } from '@/shared/config/contact';

/**
 * 봇 함정(honeypot) 입력. 문의 폼과 종목 요청 폼이 함께 쓴다.
 *
 * 사람 눈, 스크린리더, Tab 순서, 자동완성에서 모두 빠지고 필드를 전부 채우는 봇만 값을
 * 넣는다. 서버(`inquirySpamGuard`)는 값이 있으면 저장하지 않고 성공처럼 응답한다.
 * 폼 맨 끝에 둬 `space-y`가 앞 필드 간격을 건드리지 않게 한다.
 */
export function HoneypotField() {
    return (
        <div
            aria-hidden="true"
            className="absolute -left-[9999px] size-px overflow-hidden"
        >
            <input
                type="text"
                name={INQUIRY_HONEYPOT_FIELD}
                tabIndex={-1}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                defaultValue=""
            />
        </div>
    );
}
