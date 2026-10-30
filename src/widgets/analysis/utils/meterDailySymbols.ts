/**
 * 비회원 하루 무료 공개 미터 문구의 "하루 N종목" 값 해석.
 */
import { getMeteredRevealPolicy } from '@y0ngha/siglens-core';

/**
 * 미터 문구의 "하루 N종목" 폴백. core 정책(`getMeteredRevealPolicy`)이 꺼져 값이 없을 때만
 * 쓴다 — 그때는 미터 상태 자체가 오지 않아 문구가 보이지 않지만, 타입상 숫자가 필요하다.
 */
const FALLBACK_METER_DAILY_SYMBOLS = 1;

/** 문구의 종목 수 — core 정책이 단일 출처다(I18-6). */
export function resolveMeterDailySymbols(): number {
    return (
        getMeteredRevealPolicy('free')?.dailySymbols ??
        FALLBACK_METER_DAILY_SYMBOLS
    );
}
