import { meterPayload, type MeterGate } from '../meteredRevealGate';
import { omitUnfiltered } from './omitUnfiltered';

/**
 * 클라이언트로 나가는 가지: `unfilteredResult`를 떼고, 결과가 있는 상태(`cached`·`done`)에만 `meter`를
 * 싣는다. 이력 저장 구독자는 원본 `work`를 읽는다.
 *
 * 결과 없이 끝난 요청(에러·`miss_no_trigger`·한도 초과 캐시 전용 폴백의 reject)은 공개 횟수를 쓰지
 * 않도록 미터 기록을 되돌린다(`releaseMeter`, 멱등). 되돌림은 응답을 지연시키지 않게 기다리지 않는다.
 */
export function toClientWork<R extends { status: string }>(
    work: Promise<R>,
    meterGate: MeterGate,
    releaseMeter: () => Promise<void>
): Promise<Omit<R, 'unfilteredResult'>> {
    return work.then(
        result => {
            if (result.status !== 'cached' && result.status !== 'done') {
                void releaseMeter();
                return omitUnfiltered(result);
            }
            return {
                ...omitUnfiltered(result),
                ...meterPayload(meterGate),
            };
        },
        (error: unknown) => {
            void releaseMeter();
            throw error;
        }
    );
}
