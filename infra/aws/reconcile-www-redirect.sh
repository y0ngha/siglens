#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"

require aws

WWW_REDIRECT_HOST=www.siglens.io
APEX_HOST=siglens.io
WWW_REDIRECT_ACTIONS='[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","Host":"siglens.io","Path":"/#{path}","Query":"#{query}","StatusCode":"HTTP_301"}}]'
WWW_REDIRECT_CONDITIONS='[{"Field":"host-header","HostHeaderConfig":{"Values":["www.siglens.io"]}}]'

HTTPS_LISTENER_ARN=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --listener-arn)
      HTTPS_LISTENER_ARN="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

is_missing_aws_value() {
  [ -z "${1:-}" ] || [ "$1" = "None" ]
}

lookup_https_listener_arn() {
  local alb_arn
  alb_arn=$(aws elbv2 describe-load-balancers --names siglens-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null) || true

  if is_missing_aws_value "$alb_arn"; then
    echo "ERROR: siglens-alb load balancer not found; cannot reconcile ${WWW_REDIRECT_HOST} redirect" >&2
    exit 1
  fi

  aws elbv2 describe-listeners --load-balancer-arn "$alb_arn" \
    --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text
}

validate_https_listener_arn() {
  if is_missing_aws_value "$HTTPS_LISTENER_ARN"; then
    echo "ERROR: HTTPS listener ARN lookup returned empty/None; cannot reconcile ${WWW_REDIRECT_HOST} redirect" >&2
    exit 1
  fi
}

load_matching_rule_details() {
  aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER_ARN" \
    --query "Rules[?Conditions[?Field=='host-header' && contains(HostHeaderConfig.Values, '${WWW_REDIRECT_HOST}')]][0].[RuleArn, length(Conditions), length(Conditions[?Field=='host-header']), length(Conditions[?Field=='host-header'].HostHeaderConfig.Values[]), contains(Conditions[?Field=='host-header'].HostHeaderConfig.Values[], '${WWW_REDIRECT_HOST}'), length(Actions), Actions[0].Type, Actions[0].RedirectConfig.Protocol, Actions[0].RedirectConfig.Port, Actions[0].RedirectConfig.Host, Actions[0].RedirectConfig.Path, Actions[0].RedirectConfig.Query, Actions[0].RedirectConfig.StatusCode]" \
    --output text
}

load_used_listener_priorities() {
  aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER_ARN" \
    --query 'Rules[?Priority!=`default`].Priority' --output text
}

priority_in_use() {
  local priority
  for priority in $USED_LISTENER_PRIORITIES; do
    if [ "$priority" = "$1" ]; then
      return 0
    fi
  done
  return 1
}

select_redirect_priority() {
  local candidate_priority
  WWW_REDIRECT_PRIORITY=10
  if priority_in_use "$WWW_REDIRECT_PRIORITY"; then
    WWW_REDIRECT_PRIORITY=
    for candidate_priority in $(seq 11 99); do
      if ! priority_in_use "$candidate_priority"; then
        WWW_REDIRECT_PRIORITY=$candidate_priority
        break
      fi
    done
  fi

  if [ -z "$WWW_REDIRECT_PRIORITY" ]; then
    echo "No available ALB listener priority found for ${WWW_REDIRECT_HOST} redirect rule" >&2
    exit 1
  fi
}

rule_action_is_desired() {
  [ "$RULE_ACTION_COUNT" = "1" ] &&
    [ "$RULE_ACTION_TYPE" = "redirect" ] &&
    [ "$RULE_REDIRECT_PROTOCOL" = "HTTPS" ] &&
    [ "$RULE_REDIRECT_PORT" = "443" ] &&
    [ "$RULE_REDIRECT_HOST" = "$APEX_HOST" ] &&
    [ "$RULE_REDIRECT_PATH" = '/#{path}' ] &&
    [ "$RULE_REDIRECT_QUERY" = '#{query}' ] &&
    [ "$RULE_REDIRECT_STATUS" = "HTTP_301" ]
}

rule_condition_is_desired() {
  [ "$RULE_CONDITION_COUNT" = "1" ] &&
    [ "$RULE_HOST_CONDITION_COUNT" = "1" ] &&
    [ "$RULE_HOST_VALUE_COUNT" = "1" ] &&
    [ "$RULE_HOST_VALUE_MATCHES" = "True" ]
}

rule_is_desired() {
  rule_condition_is_desired && rule_action_is_desired
}

if [ -z "$HTTPS_LISTENER_ARN" ]; then
  HTTPS_LISTENER_ARN=$(lookup_https_listener_arn)
fi
validate_https_listener_arn

RULE_DETAILS=$(load_matching_rule_details)
WWW_REDIRECT_RULE_ARN=
RULE_CONDITION_COUNT=
RULE_HOST_CONDITION_COUNT=
RULE_HOST_VALUE_COUNT=
RULE_HOST_VALUE_MATCHES=
RULE_ACTION_COUNT=
RULE_ACTION_TYPE=
RULE_REDIRECT_PROTOCOL=
RULE_REDIRECT_PORT=
RULE_REDIRECT_HOST=
RULE_REDIRECT_PATH=
RULE_REDIRECT_QUERY=
RULE_REDIRECT_STATUS=
read -r WWW_REDIRECT_RULE_ARN RULE_CONDITION_COUNT RULE_HOST_CONDITION_COUNT RULE_HOST_VALUE_COUNT RULE_HOST_VALUE_MATCHES RULE_ACTION_COUNT RULE_ACTION_TYPE RULE_REDIRECT_PROTOCOL RULE_REDIRECT_PORT RULE_REDIRECT_HOST RULE_REDIRECT_PATH RULE_REDIRECT_QUERY RULE_REDIRECT_STATUS <<< "$RULE_DETAILS" || true

if is_missing_aws_value "$WWW_REDIRECT_RULE_ARN"; then
  USED_LISTENER_PRIORITIES=$(load_used_listener_priorities)
  select_redirect_priority

  aws elbv2 create-rule --listener-arn "$HTTPS_LISTENER_ARN" --priority "$WWW_REDIRECT_PRIORITY" \
    --conditions "$WWW_REDIRECT_CONDITIONS" \
    --actions "$WWW_REDIRECT_ACTIONS" >/dev/null
  log "${WWW_REDIRECT_HOST} -> ${APEX_HOST} redirect rule created (priority $WWW_REDIRECT_PRIORITY)"
  exit 0
fi

if rule_is_desired; then
  log "${WWW_REDIRECT_HOST} -> ${APEX_HOST} redirect rule already desired ($WWW_REDIRECT_RULE_ARN)"
  exit 0
fi

aws elbv2 modify-rule --rule-arn "$WWW_REDIRECT_RULE_ARN" \
  --conditions "$WWW_REDIRECT_CONDITIONS" \
  --actions "$WWW_REDIRECT_ACTIONS" >/dev/null
log "${WWW_REDIRECT_HOST} -> ${APEX_HOST} redirect rule reconciled ($WWW_REDIRECT_RULE_ARN)"
