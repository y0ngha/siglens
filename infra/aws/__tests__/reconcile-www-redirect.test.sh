#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$ROOT_DIR/infra/aws/reconcile-www-redirect.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

STUB_DIR="$TMP_DIR/bin"
mkdir -p "$STUB_DIR"
AWS_LOG="$TMP_DIR/aws.log"
export AWS_LOG

cat > "$STUB_DIR/aws" <<'AWS_STUB'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$AWS_LOG"

service="${1:-}"
operation="${2:-}"
shift 2

case "$service $operation" in
  "elbv2 describe-load-balancers")
    echo "alb/test"
    ;;
  "elbv2 describe-listeners")
    if [ "${SCENARIO:-}" = "lookup_missing_listener" ]; then
      echo "None"
    else
      echo "listener/test"
    fi
    ;;
  "elbv2 describe-rules")
    args="$*"
    if [[ "$args" == *"RuleArn, length(Conditions)"* ]]; then
      case "${SCENARIO:-}" in
        describe_rules_failure)
          echo "describe-rules failed" >&2
          exit 7
          ;;
        correct)
          printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
            "rule/www" "1" "1" "1" "True" "1" "redirect" "HTTPS" "443" "siglens.io" "/#{path}" "#{query}" "HTTP_301"
          ;;
        drifted)
          printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
            "rule/www" "1" "1" "1" "True" "1" "forward" "None" "None" "None" "None" "None" "None"
          ;;
        drifted_extra_host)
          printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
            "rule/www" "1" "1" "2" "True" "1" "redirect" "HTTPS" "443" "siglens.io" "/#{path}" "#{query}" "HTTP_301"
          ;;
        drifted_extra_condition)
          printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
            "rule/www" "2" "1" "1" "True" "1" "redirect" "HTTPS" "443" "siglens.io" "/#{path}" "#{query}" "HTTP_301"
          ;;
        *)
          echo "None"
          ;;
      esac
    elif [[ "$args" == *"Priority"* ]]; then
      case "${SCENARIO:-}" in
        priority_next)
          echo "10 12"
          ;;
        exhausted)
          seq 10 99 | tr '\n' ' '
          echo
          ;;
        *)
          echo
          ;;
      esac
    else
      echo "unexpected describe-rules query: $args" >&2
      exit 9
    fi
    ;;
  "elbv2 create-rule" | "elbv2 modify-rule")
    ;;
  *)
    echo "unexpected aws call: $service $operation $*" >&2
    exit 9
    ;;
esac
AWS_STUB
chmod +x "$STUB_DIR/aws"

EXPECTED_ACTION='[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","Host":"siglens.io","Path":"/#{path}","Query":"#{query}","StatusCode":"HTTP_301"}}]'
EXPECTED_CONDITION='[{"Field":"host-header","HostHeaderConfig":{"Values":["www.siglens.io"]}}]'

assert_log_contains() {
  local expected="$1"
  if ! grep -F -- "$expected" "$AWS_LOG" >/dev/null; then
    echo "expected log to contain: $expected" >&2
    cat "$AWS_LOG" >&2
    exit 1
  fi
}

assert_log_count() {
  local pattern="$1"
  local expected_count="$2"
  local actual_count
  actual_count=$(grep -F -c -- "$pattern" "$AWS_LOG" || true)
  if [ "$actual_count" != "$expected_count" ]; then
    echo "expected $pattern count $expected_count, got $actual_count" >&2
    cat "$AWS_LOG" >&2
    exit 1
  fi
}

run_reconcile() {
  local scenario="$1"
  : > "$AWS_LOG"
  SCENARIO="$scenario" PATH="$STUB_DIR:$PATH" bash "$SCRIPT" --listener-arn listener/test >/tmp/reconcile-www-redirect.out 2>/tmp/reconcile-www-redirect.err
}

run_reconcile missing
assert_log_count "elbv2 create-rule" 1
assert_log_count "elbv2 modify-rule" 0
assert_log_contains "--priority 10"
assert_log_contains "--conditions $EXPECTED_CONDITION"
assert_log_contains "--actions $EXPECTED_ACTION"

run_reconcile correct
assert_log_count "elbv2 create-rule" 0
assert_log_count "elbv2 modify-rule" 0

run_reconcile drifted
assert_log_count "elbv2 create-rule" 0
assert_log_count "elbv2 modify-rule" 1
assert_log_contains "--conditions $EXPECTED_CONDITION"
assert_log_contains "--actions $EXPECTED_ACTION"

run_reconcile drifted_extra_host
assert_log_count "elbv2 create-rule" 0
assert_log_count "elbv2 modify-rule" 1
assert_log_contains "--conditions $EXPECTED_CONDITION"
assert_log_contains "--actions $EXPECTED_ACTION"

run_reconcile drifted_extra_condition
assert_log_count "elbv2 create-rule" 0
assert_log_count "elbv2 modify-rule" 1
assert_log_contains "--conditions $EXPECTED_CONDITION"
assert_log_contains "--actions $EXPECTED_ACTION"

: > "$AWS_LOG"
if SCENARIO=describe_rules_failure PATH="$STUB_DIR:$PATH" bash "$SCRIPT" --listener-arn listener/test >/tmp/reconcile-www-redirect.out 2>/tmp/reconcile-www-redirect.err; then
  echo "expected describe-rules failure to fail closed" >&2
  exit 1
fi
assert_log_count "elbv2 create-rule" 0
assert_log_count "elbv2 modify-rule" 0
grep -F "describe-rules failed" /tmp/reconcile-www-redirect.err >/dev/null

run_reconcile priority_next
assert_log_count "elbv2 create-rule" 1
assert_log_contains "--priority 11"

: > "$AWS_LOG"
if SCENARIO=exhausted PATH="$STUB_DIR:$PATH" bash "$SCRIPT" --listener-arn listener/test >/tmp/reconcile-www-redirect.out 2>/tmp/reconcile-www-redirect.err; then
  echo "expected exhausted priorities to fail" >&2
  exit 1
fi
grep -F "No available ALB listener priority found" /tmp/reconcile-www-redirect.err >/dev/null

: > "$AWS_LOG"
if SCENARIO=lookup_missing_listener PATH="$STUB_DIR:$PATH" bash "$SCRIPT" >/tmp/reconcile-www-redirect.out 2>/tmp/reconcile-www-redirect.err; then
  echo "expected missing HTTPS listener lookup to fail" >&2
  exit 1
fi
grep -F "HTTPS listener ARN lookup returned empty/None" /tmp/reconcile-www-redirect.err >/dev/null

echo "reconcile-www-redirect shell scenarios passed"
