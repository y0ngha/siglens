/**
 * 사용자 본문을 로그 한 줄에 안전하게 싣는다 — 퍼센트 인코딩(`encodeURIComponent`).
 * `/api/client-error`가 `[client-error]` 로그 한 줄에 본문을 실을 때만 쓴다.
 *
 * 개행만 지우는 것으로는 부족하다. P1/P2 점수 필터는 **줄 어디에 있든** 맞는 따옴표 구문
 * 매치라(`infra/aws/07-alarms.sh`의 `put_alert_filter`), 본문에 `JavaScript heap out of
 * memory`나 `[selfcheck]`만 넣어 보내도 P1 점수 100이 올라간다. 현행 마커는 전부
 * 공백·`[`·`/` 중 하나를 품고 있고, 퍼센트 인코딩은 그 셋을 모두(그리고 개행·제어 문자를)
 * `%XX`로 바꾼다. 영숫자만으로 된 한 단어 마커를 새로 만들면 이 방어가 통하지 않으니
 * 마커에는 공백이나 괄호를 넣을 것.
 *
 * 읽을 때는 `decodeURIComponent`로 되돌린다(정보 손실 없음).
 */
export function escapeForLog(raw: string): string {
    return encodeURIComponent(raw);
}
