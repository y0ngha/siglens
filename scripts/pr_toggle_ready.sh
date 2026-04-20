#!/bin/bash

# 사용법: ./pr_toggle_ready.sh 123

PR_NUMBER=$1

if [ -z "$PR_NUMBER" ]; then
  echo "PR 번호를 입력하세요. 예: ./pr_toggle_ready.sh 123"
  exit 1
fi

echo "PR #$PR_NUMBER 을 Draft로 변경 중..."

gh pr ready "$PR_NUMBER" --undo
if [ $? -ne 0 ]; then
  echo "Draft 변경 실패"
  exit 1
fi

echo "잠시 대기 (GitHub 상태 반영)..."
sleep 2

echo "PR #$PR_NUMBER 을 Ready로 변경 중..."

gh pr ready "$PR_NUMBER"
if [ $? -ne 0 ]; then
  echo "Ready 변경 실패"
  exit 1
fi

echo "완료: Draft → Ready 전환 성공"
