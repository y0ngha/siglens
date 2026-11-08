import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { logActionError } from '@/shared/lib/logActionError';
import { createEmailDispatcher } from './dispatcher';
import type { EmailMessage } from './types';

const OPERATOR_EMAIL_ENV = 'OPERATOR_EMAIL';

/**
 * 운영자(`OPERATOR_EMAIL`)에게 알림 메일 한 통을 보낸다. 문의·VOC 즉시 알림과
 * 피드백 일일 요약이 쓴다.
 *
 * `OPERATOR_EMAIL`이 비어 있으면 아무것도 보내지 않고 `false`를 돌려준다 —
 * 수신 주소가 없는 환경(로컬, 미설정 배포)에서도 호출부는 같은 코드 경로를 탄다.
 * 전송 거절·예외는 dispatcher가 던지지 않고 `false`로 돌려주므로 여기서도 던지지 않는다.
 *
 * @returns 전송이 수락되면 true, 주소 미설정·거절이면 false
 */
export async function notifyOperator(
    message: Omit<EmailMessage, 'to'>
): Promise<boolean> {
    const to = process.env[OPERATOR_EMAIL_ENV]?.trim();
    if (!to) return false;
    return createEmailDispatcher().sendEmail({ ...message, to });
}

/**
 * 운영자 알림을 응답 **뒤**로 미뤄 보낸다(`afterWithDrain`). 문의·VOC 제출 액션이 쓴다.
 *
 * 제출 결과는 저장 성공만으로 정해지므로, Resend 왕복(최대 수 초)을 사용자가 기다릴
 * 이유가 없다. drain 레지스트리에 등록되므로 배포 중 인스턴스 교체에도 발송이 고아가
 * 되지 않는다. 실패는 로그만 남긴다 — 저장은 이미 끝났다.
 */
export function scheduleOperatorNotification(
    message: Omit<EmailMessage, 'to'>,
    logTag: string
): void {
    afterWithDrain(async () => {
        try {
            await notifyOperator(message);
        } catch (error) {
            logActionError(`${logTag} operator notification failed`, error);
        }
    });
}
