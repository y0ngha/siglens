const SUCCESS_TITLE = '문의가 접수되었습니다';
const SUCCESS_DESCRIPTION =
    '확인 후 입력하신 이메일로 답변드리겠습니다. 잠시만 기다려 주세요.';

export function ContactSubmittedNotice() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="border-secondary-800 bg-secondary-900/60 space-y-2 rounded-md border p-4 text-sm"
        >
            <p className="text-secondary-100 font-semibold">{SUCCESS_TITLE}</p>
            <p className="text-secondary-300">{SUCCESS_DESCRIPTION}</p>
        </div>
    );
}
