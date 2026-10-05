/**
 * `'use client'`를 붙이지 않는다 — 이 훅은 next-intl의 `useTranslations`만
 * 쓰고, 그건 RSC 진입점에도 있어 **경계와 무관**하다. 클라이언트 전용으로
 * 표시하면 서버 컴포넌트가 이 훅을 부르는 순간 그 서브트리 렌더가 죽는다
 * (라운드 12에 실제로 그렇게 냈다).
 */
import { useTranslations } from 'next-intl';

/**
 * 스킬 한 줄 설명(홈 쇼케이스 카드) → 로케일 문구.
 *
 * 카드에 보이는 문장은 `skills/**.md` front-matter의 `description`이 아니라
 * **스킬 이름으로 찾는 `shared.skillSummary`**다. `description`은 프롬프트 선택·
 * 개발자용 메모라 영어 원문("… interpretation guide with Bulkowski measured rates")이거나
 * "압축 primer", "게이팅" 같은 내부 용어가 섞여 있어, 방문자에게 그대로 보이면
 * 읽을 수 없다. 이름은 `useSkillLabel`이 쓰는 값과 같아 두 훅의 키가 한 곳에서 맞물린다.
 *
 * **원문 `description`을 키로 쓰던 이전 방식(`shared.skillDescription`)을 버린 이유**:
 * 영문 스킬 54종의 설명이 한국어 카탈로그에 번역될 자리가 없어("영어 제목 + 영어 본문"이
 * 한국어 페이지에 그대로 나갔다) 영어 설명 문장 하나가 곧 키가 되는 구조가 맞지 않았다.
 * 설명 문장을 고치면 키가 바뀌어 번역이 끊기는 문제도 있었다 — 이름은 안정적이다.
 *
 * 카탈로그에 없는 이름(신규 스킬)은 원문 `description`으로 떨어진다. 새 스킬을 추가하고
 * 요약 등록을 잊어도 카드가 비지 않는다 — 대신 `skillSummary` 커버리지 테스트가 그걸 잡는다.
 *
 * **`useSkillLabel`과 별도 파일인 이유**: 둘 다 `scripts/i18n/extract.mjs`가
 * 동적 키 소비자로 인식해 그 네임스페이스를 **파일 단위**로 통째로 넓힌다.
 * 한 파일에 같이 두면 `AnalysisPanel`(스킬 이름만 쓰고 설명은 안 쓴다)이
 * 닿는 모든 라우트에도 `shared.skillSummary`(95개 문장 × 4로케일)이
 * 딸려간다. 소비자가 `SkillsShowcase`(홈) 하나뿐인 이 훅을 분리하면 그 라우트에만 실린다.
 */
export function useSkillDescription(): (
    name: string,
    description: string
) => string {
    const t = useTranslations('shared.skillSummary');
    return (name, description) => (t.has(name) ? t(name) : description);
}
