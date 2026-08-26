export function ContactSubmittedNotice() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="space-y-2 rounded-lg border border-secondary-700 bg-secondary-900/60 p-4 text-sm"
        >
            <p className="font-semibold text-secondary-100">
                문의가 접수되었습니다
            </p>
            <p className="text-secondary-300">
                확인 후 입력하신 이메일로 답변드리겠습니다.
            </p>
            <p className="text-secondary-300">잠시만 기다려 주세요.</p>
        </div>
    );
}
