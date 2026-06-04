# 공지 팝업(Notice Popup) 테스트 케이스 — #559

> 변경사항: 운영 공지 팝업(`notices` 테이블 0016, `getActiveNoticesAction`, `useNoticePopup` 큐, `NoticePopup` 모달, `noticeStorage` localStorage, `matchPath` 경로 타겟).
> 실증 환경: prod build + `next start` (실 동작), docker postgres에 공지 A–F seed.

## 동작 모델 (코드 근거)
- `getActiveNoticesAction` → `findActive()`: **active(now ∈ [starts_at, ends_at] AND is_active) 공지를 priority/최신순으로 모두 반환**.
- `useNoticePopup`: 마운트 시 1회 fetch → `allNotices`. `pathname`/목록 변경 시 **큐 재구성** = `matchPath(pathPattern, pathname) && !dismissed(localStorage)` 필터. `queue[0]`만 표시.
- `NoticePopup`: `current = queue[0]`. **X / 배경 / Esc / "닫기" = `advance`**(큐 slice(1), localStorage 미변경 → 새로고침 시 재노출). **"다시 보지 않기" = `dontShowAgain`**(`dismissNotice(id)` → localStorage `siglens_dismissed_notices`에 id 추가 + slice(1)).
- `matchPath`: `null`·`/*`=전역, `/prefix/*`=접두 일치, 그 외 정확 일치.
- 링크: `toSafeHttpUrl` — http(s)만 렌더, `javascript:`/`data:` 차단.

## Seed (docker DB)
| 공지 | path_pattern | priority | active | 비고 |
|---|---|---|---|---|
| A 전역 우선 | `/` | 100 | ✅ | link `/notice-a` |
| B 전역 일반 | `/` | 50 | ✅ | link 없음 |
| C AAPL 전용 | `/AAPL/*` | 80 | ✅ | |
| D 만료 | `/` | 70 | ⛔ (ends_at 과거) | findActive 제외 |
| E 비활성 | `/` | 60 | ⛔ (is_active=false) | findActive 제외 |
| F 악성링크 | `/` | 40 | ✅ | link `javascript:alert(1)` |

→ 홈(`/`) 매칭 active: **A(100) → B(50) → F(40)** 순. `/AAPL` 매칭: **C**. D/E는 어디서도 미표시.

## 테스트 케이스

| ID | 시나리오 | 절차 | 기대 결과 | 판정 |
|---|---|---|---|---|
| **N1** | 활성 공지 표시 + 우선순위 | 홈 접속 | priority 최상위 **A** 모달 표시(`queue[0]`) | |
| **N2** | "닫기"=advance 순차 | 홈 → 닫기 → 닫기 → 닫기 | A → B → F 순차 표시, 3번째 닫기 후 모달 사라짐 | |
| **N3** | "닫기" 후 새로고침 재노출 | 홈에서 A 닫기 → F5/재접속 | A 다시 표시(advance는 dismiss 아님) | |
| **N4** | "다시 보지 않기" + 새로고침 | 홈 A "다시 보지 않기" → 새로고침 | A 미표시, **B** 표시. localStorage `siglens_dismissed_notices`=`[A.id]` | |
| **N5** | 전부 dismiss + 새로고침 | A·B·F 모두 "다시 보지 않기" → 새로고침 | 아무 모달도 안 뜸. localStorage에 3 id | |
| **N6** | path 타겟 표시 | `/AAPL` 접속 | **C** 표시(A/B/F는 `/` 정확매칭이라 미표시) | |
| **N7** | path 격리(홈) | 홈 접속 | A/B/F만, **C 미표시**(`/AAPL/*`) | |
| **N8** | 만료 공지 제외 | 어느 경로든 | **D 절대 미표시**(ends_at 과거) | |
| **N9** | 비활성 공지 제외 | 어느 경로든 | **E 절대 미표시**(is_active=false) | |
| **N10** | 악성 링크 차단 | F 표시 시 링크 영역 | `javascript:` 링크 버튼 **미렌더**(toSafeHttpUrl) | |
| **N11** | dismiss는 id별 격리 | A만 dismiss 후 새로고침 | B·F는 정상 표시(A만 제외) | |
| **N12** | 접근성 | 모달 표시 시 | `role=dialog` `aria-modal` focus-trap, Esc=닫기 | |

## 모바일 환경 테스트 케이스 (뷰포트 ~390×844, iPhone)

> 공지 모달은 `fixed inset-0 ... px-4` + `max-w-md`. 메모리: 이 레포는 iOS Safari fixed/overflow 회귀 이력이 있어 모바일에서 특히 확인.

| ID | 시나리오 | 절차 | 기대 결과 | 판정 |
|---|---|---|---|---|
| **M1** | 모바일 공지 모달 | 모바일 뷰포트 + 홈 접속 | 모달이 화면 폭(px-4 여백) 안에 들어오고 가로 오버플로우 없음, 텍스트 잘림 없음 | |
| **M2** | 모바일 버튼 탭 | 모바일에서 "다시 보지 않기"/"닫기"/✕ 탭 | 탭 타깃 정상 동작(advance/dismiss), 가림/겹침 없음 | |
| **M3** | 모바일 dismiss + 새로고침 | 모바일 A "다시 보지 않기" → 새로고침 | A 미표시, B 표시 (desktop과 동일) | |
| **M4** | 모바일 홈 렌더 | 모바일 홈 | 히어로/검색/섹터 인기종목 반응형, 가로 스크롤 없음 | |
| **M5** | 모바일 /AAPL 차트 | 모바일 /AAPL | 차트·탭·지표요약 반응형 렌더, 콘솔 에러 0 | |
| **M6** | 모바일 fundamental | 모바일 /AAPL/fundamental | 프로필·valuation·peers 테이블 반응형(가로 오버플로우 없음) | |
| **M7** | 모바일 body 가로 스크롤 | 각 페이지 모바일 | `document.documentElement.scrollWidth ≤ clientWidth`(가로 스크롤 유발 원소 없음) | |

## 검증 방법
- Chrome DevTools로 각 경로 접속/새로고침, 모달 표시·버튼 클릭 관찰.
- **모바일**: `resize_window`로 ~390×844 뷰포트 적용 후 동일 케이스(M1–M7). 가로 오버플로우는 `document.documentElement.scrollWidth`/`clientWidth` 비교로 정량 확인.
- `localStorage.getItem('siglens_dismissed_notices')`를 javascript로 직접 조회해 dismiss 동작 확정.
- 새로고침은 재접속(navigate)로 대체 가능(마운트 시 재fetch + 큐 재구성).
