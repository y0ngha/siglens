#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws
aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$ECR_REPO" \
       --image-scanning-configuration scanOnPush=true >/dev/null
aws ecr put-lifecycle-policy --repository-name "$ECR_REPO" --lifecycle-policy-text '{
  "rules":[{"rulePriority":1,"description":"keep last 3",
    "selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":3},
    "action":{"type":"expire"}}]}' >/dev/null
URI=$(aws ecr describe-repositories --repository-names "$ECR_REPO" --query 'repositories[0].repositoryUri' --output text)
log "ECR ready: $URI"
