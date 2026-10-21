// 失敗原因分類（純函式、診斷用）：只回規則標籤與 exit code，不放任何原文。
// 所有輸入欄位都可能缺失；缺欄位只會讓規則不命中，不會拋錯。

const RATE_LIMIT = /\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i;
const SERVICE_DOWN = /\b503\b|\bUNAVAILABLE\b|currently unavailable/i;

// call.error 可能是字串或物件；轉成純文字只供比對，不外流。
const asText = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value) ?? ''; } catch { return ''; }
};

// 與 adapters.mjs scanAgyStream 的條件代碼一致；其他字串不進 evidence。
const TOOL_USE_REASONS = new Set(['tool_step', 'step_type_not_allowed', 'tool_field', 'event_not_allowed', 'denied_actions', 'unparsable_line']);

const exitEvidence =raw => Number.isInteger(raw?.exitCode) ? [`exit_code:${raw.exitCode}`] : [];

// 「rate_limited_or_quota」只表示回應帶有限流／額度字樣，不代表帳號額度已用完；
// 401 文字本身不產生 auth_failed，只有任務層 task==='auth_failed' 才算。
export function classifyReviewFailure(review, reviewerModel) {
  const raw = review?.raw, call = review?.call, task = review?.task;
  const hit = (category, rule) => ({ category, evidence: [`rule:${rule}`, ...exitEvidence(raw)] });
  if (raw?.spawnError) return hit('spawn_failed', 'raw.spawnError');
  // 工具使用偵測（S3）優先於逾時／溢出等運輸錯誤；evidence 只放規則與白名單內的條件代碼。
  if (review?.tool_use_suspected === true || (Array.isArray(review?.tool_steps) && review.tool_steps.length)) {
    const reasons = Array.isArray(review?.suspect_reasons) ? review.suspect_reasons.filter(r => TOOL_USE_REASONS.has(r)) : [];
    return { category: 'tool_use_detected', evidence: ['rule:tool_use', ...new Set(reasons)] };
  }
  if (raw?.signal === 'TERMINATION_UNCONFIRMED') return hit('termination_unconfirmed', 'raw.signal');
  if (raw?.timedOut) return hit('timeout', 'raw.timedOut');
  if (raw?.overflow) return hit('output_overflow', 'raw.overflow');
  if (review?.parseError) return hit('parse_failed', 'parseError');
  if (task === 'auth_failed') return hit('auth_failed', 'task.auth_failed');
  if (task === 'environment_blocked') return hit('environment_blocked', 'task.environment_blocked');
  const channels = [['raw.stderr', asText(raw?.stderr)], ['call.error', asText(call?.error)]];
  const rate = channels.find(([, text]) => RATE_LIMIT.test(text));
  if (rate) return hit('rate_limited_or_quota', `${rate[0]}:rate_limit_pattern`);
  const down = channels.find(([, text]) => SERVICE_DOWN.test(text));
  if (down) return hit('service_unavailable', `${down[0]}:service_unavailable_pattern`);
  if (call?.truncated) return hit('truncated', 'call.truncated');
  if (task === 'policy_blocked') return hit('policy_blocked', 'task.policy_blocked');
  if (task === 'denials_unverified') return hit('denials_unverified', 'task.denials_unverified');
  if (task === 'empty') return hit('empty_response', 'task.empty');
  const id = review?.identity;
  if (!id) return hit('identity_mismatch', 'identity.missing');
  if (id.actual_model !== reviewerModel) return hit('identity_mismatch', 'identity.actual_model');
  if (id.platform !== 'antigravity' || id.source !== 'stream_init') return hit('identity_mismatch', 'identity.platform_or_source');
  if (call?.error) return hit('call_error', 'call.error');
  if (Number.isInteger(raw?.exitCode) && raw.exitCode !== 0) return hit('call_error', 'raw.exitCode');
  if (review?.value === null || review?.value === undefined) return hit('no_review_value', 'value.null');
  return hit('unknown', 'no_rule_matched');
}

// models_unavailable／version_check_failed 不代表未登入，只代表本次檢查沒取得資料。
export function classifyPreflightFailure(preflight) {
  const map = { VERSION_CHECK_FAILED: 'version_check_failed', AGY_MODELS_UNAVAILABLE: 'models_unavailable',
    REVIEWER_MODEL_NOT_OFFERED: 'model_not_offered' };
  const category = map[preflight?.error] ?? 'unknown';
  return { category, evidence: [`rule:preflight.${category === 'unknown' ? 'no_rule_matched' : preflight.error}`] };
}
