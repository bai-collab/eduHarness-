// 結果判讀第一、二層（純函式）：呼叫完成（launch/exit/timeout/error/warnings/truncated）與
// 任務完成（completed｜denials_unverified｜policy_blocked｜auth_failed｜environment_blocked｜empty｜error）。
// 不混用第三層（審查結論），見 review.mjs。
//
// V1 修正：原本用「拒絕段落佔比」推論任務是否完成，但行數比例不是完成證據（單行長文引用一次
// 「拒絕」就判阻擋；拒絕後補幾行無關內容就判完成）。companion 沒有任務專屬的完成條件，
// 因此只要出現拒絕訊號就 fail-closed：判 denials_unverified（完成與否未證實），不解析審查結論，
// 交由主 session 看產物決定。代價是審查「談論權限拒絕」的內容時可能被判 denials_unverified，
// 這是刻意偏保守的誤判方向。

const AUTH_IDENTITY_PATTERN = /not logged into antigravity/i;
const ENV_ACCESS_DENIED_PATTERN = /(access is denied|permission denied)/i;
// 只比對 agy 工具被拒時的典型說法（見 P2 F3、F4），不比對一般的「拒絕」「denied」字眼。
// V1 第 2 輪補變體（如「工具呼叫被拒絕，因此無法執行本次審查」）。這仍是啟發式，無法保證涵蓋
// 所有措辭；因此審查結論另外要求明確契約與 evidence，且一律只當 advisory（見 review.mjs）。
const DENIAL_TEXT_PATTERN = /(權限拒絕|遭到拒絕|被拒|遭拒|拒絕存取|拒絕了(這個|此|該)?(工具|操作|請求|呼叫)|無法(執行|完成)(本次|這次)?(的)?審查|auto-denied|permission denied for [a-z_]+\(|matches user-configured deny rule|headless mode cannot prompt|(was|were|been) (denied|rejected|blocked)|refused to|not permitted to)/i;

export function hasDenialText(text) {
  return DENIAL_TEXT_PATTERN.test(text ?? "");
}

export function classifyCall({ exitCode = null, signal = null, timedOut = false, spawnError = null, stderr = "", parsedOutput = null }) {
  const launch = spawnError ? "failed" : "ok";
  const stderrText = stderr ?? "";
  const warnings = [];
  if (/has no effect while slash command expansion is disabled/i.test(stderrText)) {
    warnings.push("SLASH_COMMANDS_DISABLED_WARNING");
  }
  if (/no output and no recorded error/i.test(stderrText)) {
    warnings.push("EMPTY_RUN_WARNING");
  }
  if (/^warning:/im.test(stderrText) && warnings.length === 0) {
    warnings.push("STDERR_WARNING");
  }

  // 有 init 事件（看得到 model）但沒有 result 事件，且乾淨結束：視為串流被截斷。
  const truncated = Boolean(
    parsedOutput
    && parsedOutput.model
    && !parsedOutput.result
    && !spawnError
    && !timedOut
    && exitCode === 0
  );

  return {
    launch,
    exit: exitCode,
    signal,
    timeout: Boolean(timedOut),
    error: spawnError ?? parsedOutput?.result?.error ?? null,
    warnings,
    truncated
  };
}

export function classifyTask({ status = null, response = "", deniedActions = null, stderr = "" } = {}) {
  const text = response ?? "";
  const isEmpty = text.trim() === "";
  const stderrText = stderr ?? "";
  const authIdentityMessage = AUTH_IDENTITY_PATTERN.test(stderrText);
  const envAccessDenied = ENV_ACCESS_DENIED_PATTERN.test(stderrText);

  // auth_failed 只在有 agy 身分層訊息且無回覆時；若同時有 Access is denied 的憑證／log
  // 路徑拒絕（F2 模式），判 environment_blocked，不得判未登入。
  if (authIdentityMessage && isEmpty) {
    return envAccessDenied ? "environment_blocked" : "auth_failed";
  }

  if (status === "ERROR") return "error";

  const hasDeniedActions = Array.isArray(deniedActions) && deniedActions.length > 0;
  const denialInStderr = /headless mode cannot prompt|auto-denied/i.test(stderrText);
  if (hasDeniedActions || denialInStderr || hasDenialText(text)) {
    // 有拒絕訊號：沒有產物 → policy_blocked；有產物但無法證明任務完成 → denials_unverified。
    return isEmpty ? "policy_blocked" : "denials_unverified";
  }

  if (isEmpty) return "empty"; // status: SUCCESS 但回覆空
  return "completed";
}
