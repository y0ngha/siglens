/**
 * @file provider별 "기본 모델 후보" 우선순위 테이블.
 *
 * ⚠️ **이 파일의 `*_MODEL_PRIORITY` export는 현재 production 소비처가 없다.**
 * export돼 있을 뿐 `src/` 어디에서도 호출되지
 * 않는다 — 분석 모델 기본값은 `useSelectedModel`의 `DEEPSEEK_V4_1_FLASH_MODEL`이,
 * BYOK 게이트는 `shared/lib/byokGate`가 `TIER_CONFIG`를 직접 읽어 처리한다.
 * 따라서 순서를 바꿔도 지금은 런타임 동작이 변하지 않는다.
 *
 * 그럼에도 목록을 최신으로 유지하는 이유: 나중에 "이 provider 키만 등록한 사용자에게
 * 어떤 모델을 기본으로 줄 것인가"를 소비하는 코드가 붙었을 때, 낡은 목록이면 신규
 * 모델이 조용히 후보에서 빠진다. `providerDefaults.test.ts`의 coverage 테스트가
 * MODEL_SPECS와의 누락을 감시한다.
 *
 * **정렬은 기계적 규칙이 아니라 판단이다.** "그 키만 가진 사용자에게 기본으로 주기
 * 가장 적절한 모델" 순이며, 라인 등급(pro/flash/lite 같은 성능 계층)과 세대 중
 * 어느 쪽도 항상 이기지 않는다. 그래서 목록마다 근거를 한 줄씩 남긴다 — 새 모델을
 * 끼워 넣을 때는 그 근거에 맞춰 위치를 정하고, 근거가 바뀌면 주석도 함께 고칠 것.
 */
import type { ModelId } from '@y0ngha/siglens-core';

/** 세대 우선 — Anthropic은 세대 갭이 라인 갭보다 크다고 보고 5세대를 모두 앞에 둔다. */
export const CLAUDE_MODEL_PRIORITY: readonly ModelId[] = [
    'claude-fable-5-1',
    'claude-opus-5-5',
    'claude-opus-5',
    'claude-opus-4-8',
    'claude-sonnet-5-5',
    'claude-haiku-5-5',
];

/**
 * 라인 우선(Pro급 → Flash → Flash-Lite), 라인 안에서 세대 우선.
 * 3세대 신모델(3.8/3.6/3.5)은 Flash·Flash-Lite 라인에만 있어 세대를 앞세우면 Pro 3.1이
 * Flash 뒤로 밀린다 — 그래서 Pro 3.1을 Flash보다 앞에 둔다. 4세대 Argon은 Pro급
 * 추론 모델이지만 BYOK 전용·고가($2/$10, 2026-12부터 $4/$20)라 기본값 후보로는
 * 검증된 Pro 3.1 다음, Flash 라인 앞에 둔다.
 */
export const GEMINI_MODEL_PRIORITY: readonly ModelId[] = [
    'gemini-3.1-pro-preview',
    'gemini-4-argon',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
];

/**
 * 변형 등급 우선(astra → sol → luna), 같은 등급 안에서는 세대 우선(6.1 → 6 → 5.6).
 * luna는 6세대지만 경량 변형이라 기본값 후보로는 5.6 sol보다 뒤에 둔다.
 */
export const CHATGPT_MODEL_PRIORITY: readonly ModelId[] = [
    'gpt-6-astra',
    'gpt-6.1-sol',
    'gpt-6-sol',
    'gpt-5.6-sol',
    'gpt-6-luna',
];

/**
 * 유일하게 성능 역순 — v4.1-pro가 상위 라인이지만 flash가 앱 전역
 * 기본 모델(`DEEPSEEK_V4_1_FLASH_MODEL`)이라 기본값 후보로도 flash를 먼저 둔다.
 */
export const DEEPSEEK_MODEL_PRIORITY: readonly ModelId[] = [
    'deepseek-v4.1-flash',
    'deepseek-v4.1-pro',
];
