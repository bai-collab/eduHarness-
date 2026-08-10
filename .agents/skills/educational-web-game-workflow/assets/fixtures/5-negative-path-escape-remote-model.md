# Negative Fixture：路徑逃逸與未知遠端模型

> 只測路徑白名單與未知模型停止規則，不是瀏覽器或教學證據。

- 教材：假想的地層剖面教材
- 學習目標：學生能依剖面判斷地層順序
- 分支：web
- 資產目的地：`../outside-workspace/model.glb`
- 模型來源：未知遠端 URL，沒有 pinned runtime 或核准 executor
- 預期狀態：stopped
- 停止原因：unsafe-path-or-unknown-remote-model
- 禁止：正規化後仍逃出工作區時寫入任何檔案
