// 解析 agy --output-format stream-json 的輸出：init 事件取 model／tools，result 事件取
// status／response／conversation_id／error；step_update 中 step_type 為 tool 的事件收集成
// toolSteps（同一 step_index 只留最後狀態，格式見 P2 F13），供審查結論核對 evidence 是否真的讀過。
// 其餘事件容忍略過。
// 相容性取捨：P2 探測有部分呼叫用 --output-format json（單一 JSON 物件、無 "event" 欄位），
// 這裡也容忍解析成等效的 result（沒有 event 包裝、但有 "status" 欄位的行視為隱含 result 事件），
// 讓同一套判讀器可以直接吃 P2 的真實輸出當 fixture。

export function parseAgyOutput(stdout) {
  const text = typeof stdout === "string" ? stdout.replace(/^﻿/, "") : "";
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  let model = null;
  let tools = null;
  let result = null;
  const toolStepsByIndex = new Map();

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;

    if (obj.event === "init") {
      if (obj.init?.model) model = obj.init.model;
      if (Array.isArray(obj.init?.tools)) tools = obj.init.tools;
      continue;
    }
    if (obj.event === "result") {
      result = obj.result ?? null;
      continue;
    }
    if (obj.event === "step_update" && obj.step_update?.step_type === "tool") {
      const step = obj.step_update;
      toolStepsByIndex.set(step.step_index, {
        index: step.step_index,
        name: step.tool_name ?? step.tool_info?.name ?? null,
        state: step.state ?? null,
        parameters: step.tool_info?.parameters ?? {},
        output: typeof step.tool_info?.output === "string" ? step.tool_info.output : null
      });
      continue;
    }
    if (obj.event) continue; // 其餘 stream-json 事件容忍略過

    // 沒有 event 欄位，但有 status：視為 --output-format json 的單一結果物件。
    if (Object.prototype.hasOwnProperty.call(obj, "status")) {
      result = obj;
    }
  }

  // hasStepEvents：這份輸出是否為 stream-json（有事件包裝）。json 格式沒有工具步驟可核對。
  const hasStepEvents = lines.some(line => line.startsWith('{"event":"step_update"'));
  return { model, tools, result, toolSteps: [...toolStepsByIndex.values()], hasStepEvents };
}
