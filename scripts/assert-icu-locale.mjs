// ICU 회귀 가드 — 서버 Intl 출력이 브라우저(Chrome)와 다르면 하이드레이션이 깨진다.
// 2026-09-17 운영 실측: node:22-alpine(v22.23, ICU 78.2)이 ko-KR 오전/오후를 "PM"으로,
// compact 통화를 "US$1952.0억"으로 냈다. 브라우저는 "오후"·"US$1952억"이라 뉴스·재무제표·
// 경제 페이지 전부에서 React #418(서버 텍스트 불일치)이 나고 SSR 트리를 클라에서 다시 그렸다.
// 태그가 떠다니는 이미지라 같은 회귀가 조용히 돌아올 수 있어 빌드/런타임 이미지에서 막는다.
//
// 세 번째 체크(연·월 이름·일)는 `src/shared/lib/formatSnapshotAsOf.ts`가 실제로 쓰는
// 옵션 조합 그대로다 — 그 파일이 직접 자체 검증하지 않는 포맷을 여기서 대신 확인한다.

const checks = [
    {
        label: 'ko-KR 시각(hour12)',
        actual: new Intl.DateTimeFormat('ko-KR', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC',
        }).format(Date.UTC(2020, 0, 1, 15, 30)),
        expected: '오후 3:30',
    },
    {
        label: 'ko-KR compact 통화',
        actual: new Intl.NumberFormat('ko-KR', {
            notation: 'compact',
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 1,
        }).format(1952e8),
        expected: 'US$1952억',
    },
    {
        label: 'ko-KR 연·월(long)·일 (formatSnapshotAsOf.ts와 동일 옵션)',
        actual: new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(Date.UTC(2026, 0, 15, 12)),
        expected: '2026년 1월 15일',
    },
];

const failures = checks.filter(c => c.actual !== c.expected);
if (failures.length > 0) {
    for (const f of failures) {
        console.error(
            `FAIL: ${f.label} — actual="${f.actual}" expected="${f.expected}"`
        );
    }
    process.exit(1);
}
console.log('OK: ICU ko-KR 출력이 브라우저와 일치');
