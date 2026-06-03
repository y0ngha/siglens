import { test, expect } from '../support/fixtures';
import { seedNotices } from '../support/noticeSeeder';

/**
 * 공지 팝업 (`NoticePopup`) E2E — Tier 3 클라이언트 행동.
 *
 * `notices` 테이블 행을 per-test로 직접 시딩하고 afterEach에서 삭제해
 * 테스트 간 독립성을 보장한다. localStorage(siglens_dismissed_notices)는
 * beforeEach에서 초기화해 dismiss 상태 누출을 차단한다.
 *
 * NoticePopup 동작 요약:
 *   - 마운트 시 `getActiveNoticesAction()` (서버 액션) 호출 → 경로 매칭 + dismiss 필터 후 큐
 *   - X 버튼(aria-label="팝업 닫기") / "닫기" 버튼 / Esc / 배경 클릭 = 임시 닫기
 *     (localStorage에 저장되지 않으므로 다음 방문 시 재노출)
 *   - "다시 보지 않기" = id를 localStorage(`siglens_dismissed_notices`)에 영구 저장
 *     → 다음 방문에서도 표시 안 됨
 *   - pathPattern = null이면 전역(모든 경로), '/market'이면 해당 경로에서만 표시
 *
 * 관련 테스트 ID:
 *   - notice-modal-content  (data-testid)
 *   - notice-modal-backdrop (data-testid)
 */

/** 테스트 UUID — 실제 공지와 충돌하지 않을 임의 고정값. */
const GLOBAL_NOTICE_ID = '11111111-e2e1-4000-8000-000000000001';
const PATH_NOTICE_ID = '22222222-e2e2-4000-8000-000000000002';

/**
 * Matches DISMISSED_NOTICES_STORAGE_KEY in src/widgets/notice-popup/utils/noticeStorage.ts.
 * Playwright 스펙은 src의 server-only 체인을 import할 수 없어 리터럴을 복제한다.
 * noticeStorage.ts에서 키를 바꾸면 이 값도 함께 갱신할 것 (update both if changed).
 */
const DISMISSED_KEY = 'siglens_dismissed_notices';

test.describe('공지 팝업', () => {
    // localStorage를 초기화해 이전 테스트의 dismiss 상태가 남지 않도록 함.
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(key => localStorage.removeItem(key), DISMISSED_KEY);
    });

    /**
     * 1. 활성 전역 공지 시딩 → `notice-modal-content` 표시
     */
    test.describe('활성 공지 표시', () => {
        let cleanup: () => Promise<void>;

        test.beforeEach(async () => {
            cleanup = await seedNotices([
                {
                    id: GLOBAL_NOTICE_ID,
                    title: 'E2E 공지 테스트 제목',
                    body: 'E2E 공지 본문입니다.',
                    pathPattern: null, // 전역
                    priority: 99,
                },
            ]);
        });

        test.afterEach(async () => {
            await cleanup?.();
        });

        test('활성 공지가 시딩되면 / 방문 시 모달이 표시된다', async ({
            page,
        }) => {
            await page.goto('/');

            const modal = page.getByTestId('notice-modal-content');
            await expect(modal).toBeVisible();
            await expect(modal).toContainText('E2E 공지 테스트 제목');
        });
    });

    /**
     * 2. "다시 보지 않기" → localStorage에 저장 → 새로고침 후 미표시
     */
    test.describe('다시 보지 않기 영구 dismiss', () => {
        let cleanup: () => Promise<void>;

        test.beforeEach(async () => {
            cleanup = await seedNotices([
                {
                    id: GLOBAL_NOTICE_ID,
                    title: 'E2E 공지 테스트 제목',
                    body: 'E2E 공지 본문입니다.',
                    pathPattern: null,
                    priority: 99,
                },
            ]);
        });

        test.afterEach(async () => {
            await cleanup?.();
        });

        test('"다시 보지 않기" 클릭 시 모달이 닫히고, 새로고침 후 재표시되지 않는다', async ({
            page,
        }) => {
            await page.goto('/');

            const modal = page.getByTestId('notice-modal-content');
            await expect(modal).toBeVisible();

            await page.getByRole('button', { name: '다시 보지 않기' }).click();

            await expect(modal).not.toBeVisible();

            // localStorage에 ID가 저장됐는지 확인
            const stored = await page.evaluate(
                key => localStorage.getItem(key),
                DISMISSED_KEY
            );
            expect(stored).not.toBeNull();
            const parsed: unknown = JSON.parse(stored!);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed as string[]).toContain(GLOBAL_NOTICE_ID);

            // 새로고침 후에도 모달이 나타나지 않아야 함
            await page.reload();
            await expect(
                page.getByTestId('notice-modal-content')
            ).not.toBeVisible();
        });
    });

    /**
     * 3. "닫기" 임시 닫기 → 새로고침 후 재표시
     */
    test.describe('닫기 임시 dismiss', () => {
        let cleanup: () => Promise<void>;

        test.beforeEach(async () => {
            cleanup = await seedNotices([
                {
                    id: GLOBAL_NOTICE_ID,
                    title: 'E2E 공지 테스트 제목',
                    body: 'E2E 공지 본문입니다.',
                    pathPattern: null,
                    priority: 99,
                },
            ]);
        });

        test.afterEach(async () => {
            await cleanup?.();
        });

        test('"닫기" 클릭 시 모달이 닫히고, 새로고침 후 다시 표시된다', async ({
            page,
        }) => {
            await page.goto('/');

            const modal = page.getByTestId('notice-modal-content');
            await expect(modal).toBeVisible();

            // Playwright의 name은 기본 부분 일치라 X 버튼(aria-label="팝업 닫기")까지
            // 잡힌다. 하단 "닫기" 버튼만 겨냥하도록 exact 매칭을 쓴다.
            await page
                .getByRole('button', { name: '닫기', exact: true })
                .click();

            await expect(modal).not.toBeVisible();

            // 임시 닫기는 localStorage에 절대 기록하지 않는다.
            const stored = await page.evaluate(
                key => localStorage.getItem(key),
                DISMISSED_KEY
            );
            expect(stored).toBeNull();

            // 새로고침 후 모달이 다시 표시됨
            await page.reload();
            await expect(
                page.getByTestId('notice-modal-content')
            ).toBeVisible();
        });
    });

    /**
     * 4. 경로 타겟팅 — pathPattern='/market'인 공지는
     *    `/`에서 표시 안 되고, `/market`에서만 표시됨
     */
    test.describe('경로 타겟팅', () => {
        let cleanup: () => Promise<void>;

        test.beforeEach(async () => {
            cleanup = await seedNotices([
                {
                    id: PATH_NOTICE_ID,
                    title: 'E2E 마켓 전용 공지',
                    body: '마켓 페이지에서만 보이는 공지입니다.',
                    pathPattern: '/market',
                    priority: 99,
                },
            ]);
        });

        test.afterEach(async () => {
            await cleanup?.();
        });

        test('pathPattern="/market" 공지는 / 에서 표시되지 않는다', async ({
            page,
        }) => {
            await page.goto('/');
            await expect(
                page.getByTestId('notice-modal-content')
            ).not.toBeVisible();
        });

        test('pathPattern="/market" 공지는 /market 에서 표시된다', async ({
            page,
        }) => {
            await page.goto('/market');

            const modal = page.getByTestId('notice-modal-content');
            await expect(modal).toBeVisible();
            await expect(modal).toContainText('E2E 마켓 전용 공지');
        });
    });

    /**
     * 5. 비노출 조건 — is_active=false / starts_at 미래 / ends_at 과거인 공지는
     *    DB에 존재하더라도 클라이언트에 노출되지 않아야 한다.
     */
    test.describe('비노출 조건', () => {
        // 각 테스트가 고유 UUID를 사용해 기존 GLOBAL/PATH id와 충돌하지 않도록 한다.
        const INACTIVE_ID = '33333333-e2e3-4000-8000-000000000003';
        const FUTURE_ID = '44444444-e2e4-4000-8000-000000000004';
        const EXPIRED_ID = '55555555-e2e5-4000-8000-000000000005';

        let cleanup: () => Promise<void>;

        test.afterEach(async () => {
            await cleanup?.();
        });

        test('is_active=false 공지는 / 에서 표시되지 않는다', async ({
            page,
        }) => {
            cleanup = await seedNotices([
                {
                    id: INACTIVE_ID,
                    title: 'E2E 비활성 공지',
                    body: '비활성 공지입니다.',
                    pathPattern: null,
                    priority: 99,
                    isActive: false,
                },
            ]);

            await page.goto('/');
            await expect(
                page.getByTestId('notice-modal-content')
            ).not.toBeVisible();
        });

        test('starts_at이 미래인 공지는 / 에서 표시되지 않는다', async ({
            page,
        }) => {
            cleanup = await seedNotices([
                {
                    id: FUTURE_ID,
                    title: 'E2E 미래 시작 공지',
                    body: '아직 시작 전인 공지입니다.',
                    pathPattern: null,
                    priority: 99,
                    startsAt: new Date(Date.now() + 86400000).toISOString(),
                },
            ]);

            await page.goto('/');
            await expect(
                page.getByTestId('notice-modal-content')
            ).not.toBeVisible();
        });

        test('ends_at이 과거인 공지는 / 에서 표시되지 않는다', async ({
            page,
        }) => {
            cleanup = await seedNotices([
                {
                    id: EXPIRED_ID,
                    title: 'E2E 만료된 공지',
                    body: '이미 종료된 공지입니다.',
                    pathPattern: null,
                    priority: 99,
                    endsAt: new Date(Date.now() - 86400000).toISOString(),
                },
            ]);

            await page.goto('/');
            await expect(
                page.getByTestId('notice-modal-content')
            ).not.toBeVisible();
        });
    });
});
