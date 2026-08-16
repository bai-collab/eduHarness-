# User Authority and Flexible Planning

## Authority order

```text
User decision > task-specific user directives > selected Skill > registry default > model suggestion
```

模型可以提出方案，但不能自動把建議變成使用者同意。Complex profile 沒有明確 user decision 時，Harness 停在 `awaiting_user`。

## User directives

Task 可以使用：

```json
{
  "user_directives": {
    "profile": "standard",
    "blocks": ["classify", "context", "user-authority", "execute", "verify"],
    "add_blocks": ["reason"],
    "skip_blocks": ["context"],
    "adapter": "rule-tool",
    "decision": "approve",
    "skill_dependency_decisions": {
      "tainan-item-authoring->item-authoring": "skip"
    }
  }
}
```

`skip_blocks` 只能跳過 registry 標記為 optional 的區塊。這個限制是為了避免把基本 user authority 與 verification 靜默移除；若要修改這個安全邊界，應建立新的 Kernel 版本與明確決定紀錄。

Skill 的 optional dependency 另用 `skill_dependency_decisions` 表達，不把一般的 `decision: "approve"` 當成自動載入許可。若沒有決定，Harness 會在 `user_decision.skill_dependency_questions` 提出繁中問題、建議與兩個選項；使用者可以回傳 `"approve"` 載入，或 `"skip"` 保持精簡路徑。這個選擇只影響 `skill_resolution`，不會修改 `route_plan`。
