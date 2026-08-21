/**
 * `'use client'`를 붙이지 않는다 — 이 훅은 next-intl의 `useTranslations`만
 * 쓰고, 그건 RSC 진입점에도 있어 **경계와 무관**하다. 클라이언트 전용으로
 * 표시하면 서버 컴포넌트가 이 훅을 부르는 순간 그 서브트리 렌더가 죽는다
 * (라운드 12에 실제로 그렇게 냈다).
 */
import { useTranslations } from 'next-intl';

/**
 * next-intl은 메시지 키에 리터럴 `.`을 못 쓴다 — 중첩 경로 구분자로 예약돼
 * 있어 `.` 포함 키가 하나라도 있으면 `IntlError: INVALID_KEY`로 카탈로그
 * 전체 로드가 거부된다. 스킬 설명 74개 중 12개가 버전 표기·소수 파라미터
 * (`λ=0.94`, `Keltner Channel(20, 10, 2.0)` 등)로 `.`을 포함한다.
 *
 * 전각 마침표(U+FF0E, `．`)로 치환해 저장·조회한다 — 시각적으로 거의
 * 동일하면서 next-intl의 예약 문자와 충돌하지 않는다. 카탈로그 빌드
 * 스크립트도 동일한 치환을 적용해 키를 만든다(메모리 `project_i18n_*` 참고).
 */
export function toSkillDescriptionKey(description: string): string {
    return description.replaceAll('.', '．');
}

/**
 * 스킬 설명(`skills/**.md` front-matter의 `description`) → 로케일 문구.
 *
 * `useSkillLabel`(`./skillLabel.ts`)과 동일한 이유·동일한 훅 형태 — 원본은
 * `skills/**.md`의 `description:` 필드이고 74개가 한국어라(영문 스킬 7종은
 * 이미 영어) 영어 페이지의 스킬 카드가 "Indicator Core Reference / 지표 /
 * 계산되는 모든 지표의 1줄 임계 요약 …"처럼 제목만 번역되고 본문은 한국어로
 * 남았다.
 *
 * **`useSkillLabel`과 별도 파일인 이유**: 둘 다 `scripts/i18n/extract.mjs`가
 * 동적 키 소비자로 인식해 그 네임스페이스를 **파일 단위**로 통째로 넓힌다.
 * 한 파일에 같이 두면 `AnalysisPanel`(스킬 이름만 쓰고 설명은 안 쓴다)이
 * 닿는 모든 라우트에도 `shared.skillDescription`(74개 문장 × 4로케일)이
 * 딸려간다 — 실측: 크롬 페이로드가 예산(15%)을 23.8%로 넘겼다. 소비자가
 * `SkillsShowcase`(홈) 하나뿐인 이 훅을 분리하면 그 라우트에만 실린다.
 *
 * 원문(설명)은 dedupe·토글 키로 쓰이지 않는다(그 역할은 `name`이 한다) —
 * 그래도 `useSkillLabel`과 동일 패턴을 유지해 두 훅이 항상 같이 갱신되게 한다.
 */
export function useSkillDescription(): (description: string) => string {
    const t = useTranslations('shared.skillDescription');
    return description => {
        const key = toSkillDescriptionKey(description);
        return t.has(key) ? t(key) : description;
    };
}
