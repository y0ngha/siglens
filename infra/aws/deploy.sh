#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"
bash "$(dirname "$0")/05-launch-template.sh" "$TAG"
aws autoscaling start-instance-refresh --auto-scaling-group-name siglens-asg \
  --preferences '{"MinHealthyPercentage":100,"InstanceWarmup":180}' --query InstanceRefreshId --output text
log "instance refresh started for $TAG"
