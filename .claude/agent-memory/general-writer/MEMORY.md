# Memory Index

## Feedback

- [shared→entities 파일 이동 전 레이어 확인](feedback_shared_type_move_layering_check.md) — shared 파일이 그 타입을 쓰면 통째 이동은 FSD 위반. 타입/로직 분리로 해결
- [Drizzle repo 테스트는 실제 shape을 열어 단언](feedback_drizzle_repo_test_assert_actual_shape.md) — call count만 세면 버그가 있어도 통과. collectColumnNames/collectSqlStrings 재사용
- [테스트 falsifiability 검증은 git show+cp로, stash 금지](feedback_mutation_test_via_git_show_not_stash.md) — 파일별 백업→git show HEAD로 되돌림→스코프 테스트→복원. 실패 개수를 정확히 보고. 단 파일에 미커밋 선행작업 있으면 git show HEAD 대신 세션 시작 시점 cp 백업 사용
- [뮤테이션 테스트 시 무관한 기존 테스트 동반 실패 구분](feedback_mutation_test_collateral_failures.md) — call-count 결합 때문에 생기는 부수 실패는 새 회귀 테스트 검증과 별개로 보고

## Project

- [asset_translations는 korean_tickers 수정에 self-heal 안 됨](project_asset_translations_no_self_heal.md) — 큐레이션 이름 버그 수정 시 DB 2곳(korean_tickers 자동/asset_translations 수동) + 캐시 2곳 확인 필요

## Reference

- [vi.spyOn().mockRestore()는 mock.calls도 지운다](reference_vitest_mockrestore_clears_calls.md) — finally에서 restore 전에 호출 기록을 먼저 떼어 둬야 함
- [dynamicDecimals는 trailing zero를 패딩한다](reference_dynamic_decimals_sig_fig_padding.md) — sub-$1 정확값 단언은 node로 실측 후 작성(예: $0.0006 → 실제 "$0.0006000")
- [동적 배열 회전 테스트는 shadow-model oracle로](reference_shadow_model_oracle_for_stateful_rotation_tests.md) — 도메인 함수는 실물 재사용, offset 산술만 재구현 후 매 tick 정확히 비교. 커버리지만 단언하면 뮤테이션에 안 걸릴 수 있음
