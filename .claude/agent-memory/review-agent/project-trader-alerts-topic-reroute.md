---
name: project-trader-alerts-topic-reroute
description: siglens-trader chore/reuse-siglens-alerts-topic — provision.sh now publishes to shared siglens-alerts topic
metadata:
  type: project
---

siglens-trader's dedicated SNS topic (`siglens-trader-alerts`) had 0 confirmed subscribers because
`ALARM_EMAIL` was never set at provisioning — both alarms (cron failures, instance status check)
notified nobody. Fix rerouted `infra/aws/provision.sh` to publish to the shared, already-confirmed
`siglens-alerts` topic (default, overridable via `ALARM_TOPIC_NAME`), added a
`SubscriptionsConfirmed == 0` warning, and updated README.md/DEPLOYMENT.md prose.

Reviewed 2026-09-14: correct under `set -euo pipefail`, `create-topic` idempotency claim verified
true (returns existing ARN without touching subscriptions), no dangling references to the old
topic name or unused `ALARM_EMAIL` var outside an explanatory comment. Approved with zero findings.
