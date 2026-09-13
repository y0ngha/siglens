/**
 * CloudWatch metric-filter marker for capacity refusals (`siglens-agent-busy`
 * in infra/aws/07-alarms.sh). Shared by the fresh-analysis slot gate and the
 * stream route's turn-slot gate; renaming it silently kills the alarm.
 */
export const AGENT_BUSY_LOG = '[agent] busy';
