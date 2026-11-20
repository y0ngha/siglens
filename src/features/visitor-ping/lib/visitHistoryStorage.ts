import {
    advanceVisitHistory,
    isReturnVisitDay,
    parseVisitHistory,
    visitSignalsOf,
} from '@/entities/visitor/lib/visitHistory';
import type { VisitSignals } from '@/entities/visitor/types';

/**
 * 방문 이력 저장 키(브라우저 로컬 스토리지, 호스트별). 값은 `VisitHistory` JSON — 날짜 3개와 날 수뿐이고
 * 식별자는 없다. 서버로는 가지 않으며 구간값(`VisitSignals`)으로 바뀌어 비콘에 실린다.
 * 개인정보처리방침 v15 §7이 이 키를 고지한다(가드 `visitHistoryPrivacy`).
 */
export const VISIT_HISTORY_STORAGE_KEY = 'siglens:visit-history:v1';

/**
 * 읽기 → 오늘 방문 반영 → 쓰기 → 구간값. 저장소를 읽거나 쓸 수 없으면 `null`이다. 던지지 않는다.
 *
 * `setItem`이 실패하면 `null`을 돌려준다 — 저장하지 못하는 브라우저를 매일 `new`로 보고하면
 * 재방문이 신규로 둔갑한다. 반영 결과가 저장된 값과 같은 객체일 때(같은 날 재전송)는 쓰지 않는다.
 * 깨진 값은 첫 방문으로 다루고 새 값으로 덮어쓴다.
 */
export function claimVisitSignals(today: string): VisitSignals | null {
    try {
        const stored = parseVisitHistory(
            window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY)
        );
        const next = advanceVisitHistory(stored, today);
        if (next !== stored) {
            window.localStorage.setItem(
                VISIT_HISTORY_STORAGE_KEY,
                JSON.stringify(next)
            );
        }
        // 기기 시계가 과거로 갔으면 `null`(구간값 없음) — `visitSignalsOf` 참고. 이력은 건드리지 않았다.
        return visitSignalsOf(next, today);
    } catch {
        return null;
    }
}

/**
 * 오늘이 이 브라우저의 첫 방문일보다 뒤인가. 저장된 첫 방문 날짜만 브라우저 안에서 읽는다 — 쓰지도,
 * 서버로 보내지도 않는다(개인정보처리방침 v15 §7의 `siglens:visit-history:v1` 항목이 이 읽기를 고지한다).
 *
 * 앱 설치 안내(`features/pwa-install`)가 재방문일부터 뜨게 하는 데 쓴다. 저장소를 읽을 수 없거나(프라이빗
 * 모드·차단) 값이 깨졌으면 `false` — 이력을 모르는 브라우저에는 안내를 띄우지 않는다. 던지지 않는다.
 */
export function readIsReturnVisitDay(today: string): boolean {
    try {
        return isReturnVisitDay(
            parseVisitHistory(
                window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY)
            ),
            today
        );
    } catch {
        return false;
    }
}
