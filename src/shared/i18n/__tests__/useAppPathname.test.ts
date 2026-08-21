import { execSync } from 'node:child_process';

/**
 * `usePathname()` 직접 사용 감사.
 *
 * 로케일 접두사가 붙은 경로를 **비교·매칭**에 쓰면 그 기능이 비-ko 사용자에게서
 * 조용히 꺼진다(활성 탭·경로 지정 공지·챗 페이지 컨텍스트가 실제로 그랬다).
 * 반대로 **이동에 재사용**하는 경로는 접두사가 있어야 한다. 자동으로 구분할 수
 * 없으므로, 직접 호출하는 파일을 목록으로 고정하고 새 항목이 생기면 실패시킨다 —
 * 그때 사람이 둘 중 어느 쪽인지 판단해 이 목록이나 `useAppPathname`으로 보낸다.
 */
const ALLOWED_RAW_PATHNAME_USERS = [
    // 이동에 재사용 — 접두사가 있어야 한다.
    'src/shared/hooks/useQueryParamState.ts',
    'src/widgets/dashboard/hooks/useSectorSignalState.ts',
    'src/features/backtest-filter/hooks/useBacktestFilter.ts',
    // 경로 변경 감지 키로만 쓴다 — 접두사 유무가 무관하다.
    'src/app/_components/AuthSessionHeaderClient.tsx',
    // 검색 오버레이 3종도 "경로가 바뀌었다"만 본다(도착 감지 → 오버레이 닫기,
    // 진행 바 끄기). 접두사가 붙은 값이 오히려 맞다 — 로케일 전환도 이동이다.
    'src/features/ticker-search/ui/SearchOverlay.tsx',
    'src/features/ticker-search/hooks/useSearchOverlay.ts',
    'src/features/ticker-search/model/SearchOverlayContext.tsx',
    // 이 훅 자신이 접두사를 뗀다.
    'src/shared/i18n/useAppPathname.ts',
    // next-intl의 navigation(이미 접두사를 뗀 값을 준다)을 쓴다.
    'src/widgets/layout/LocaleSwitcher.tsx',
];

describe('usePathname 직접 사용', () => {
    it('허용 목록 밖에서 next/navigation의 usePathname을 쓰지 않는다', () => {
        const raw = execSync(
            "grep -rln 'usePathname' src --include='*.ts' --include='*.tsx' || true",
            { encoding: 'utf8' }
        );
        const offenders = raw
            .split('\n')
            .filter(Boolean)
            .filter(f => !f.includes('__tests__') && !f.includes('.test.'))
            .filter(f => !ALLOWED_RAW_PATHNAME_USERS.includes(f))
            // 주석에서만 언급하는 파일은 제외한다.
            .filter(f => {
                const source = execSync(`cat ${JSON.stringify(f)}`, {
                    encoding: 'utf8',
                });
                return /^\s*import\b.*usePathname/m.test(source);
            });
        expect(offenders).toEqual([]);
    });
});
