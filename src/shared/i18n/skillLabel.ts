/**
 * `'use client'`를 붙이지 않는다 — 이 훅은 next-intl의 `useTranslations`만
 * 쓰고, 그건 RSC 진입점에도 있어 **경계와 무관**하다. 클라이언트 전용으로
 * 표시하면 서버 컴포넌트가 이 훅을 부르는 순간 그 서브트리 렌더가 죽는다
 * (라운드 12에 실제로 그렇게 냈다).
 */
import { useTranslations } from 'next-intl';

/**
 * 스킬 표시명(패턴·전략·지표) → 로케일 문구.
 *
 * 이름은 `skills/**.md` front-matter의 `name`이고 core가 그대로 응답에 싣는다.
 * 36개가 한국어라 영어 페이지에서 아코디언 **제목만** 한국어로 남았다.
 *
 * 원본 문자열은 못 바꾼다 — `AnalysisPanel`에서 **dedupe 키**로도 쓰여
 * 번역하면 중복 제거가 깨진다. 그래서 표시 시점에만 바꾼다.
 *
 * 전용 네임스페이스와 훅 형태인 이유는 `useAssetLabel`과 같다.
 * 카탈로그에 없는 이름(영문 스킬 45종, 신규 스킬)은 원문으로 떨어진다.
 */
export function useSkillLabel(): (name: string) => string {
    const t = useTranslations('shared.skillName');
    return name => (t.has(name) ? t(name) : name);
}
