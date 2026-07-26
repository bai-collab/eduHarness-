---
name: api-design
description: 指導穩定的 API 與介面設計。在設計 API、模組邊界或任何公開介面時使用。適用於建立 REST/GraphQL 端點、定義模組間的類型契約，或建立前後端邊界。
---

# API 與介面設計

## Do Not Use When(anti-triggers)
- API 已定案只需實作(→ tdd)
- UI-only 或無外部介面的內部重構

## 核心目標

設計穩定、文件齊備且「難以誤用」的介面。好的介面應該讓「正確的事變得簡單，錯誤的事變得困難」。這適用於 REST API、GraphQL Schema、模組邊界、組件 Props，以及任何程式碼互動的表面。

## 何時使用

- 設計新的 API 端點。
- 定義團隊間的模組邊界或契約 (Contracts)。
- 建立 UI 組件的 Prop 介面。
- 建立會影響 API 形狀的資料庫 Schema。
- 修改現有的公開介面。

## 核心準則

### 1. 海勒姆定律 (Hyrum's Law)
> 當一個 API 有足夠多的使用者時，你在契約中承諾什麼並不重要：系統中所有可觀察到的行為，都會被某些人依賴。

**設計啟示：**
- **謹慎暴露行為**：任何可觀察到的行為（如錯誤訊息文字、回應時間、排序）都可能變成事實上的契約。
- **不要洩漏實作細節**：如果使用者看得到，他們就會依賴它。
- **預先規劃棄用 (Deprecation)**：在設計時就考慮如何安全地移除功能。

### 2. 契約優先 (Contract First)
在開始實作前先定義介面。契約就是規格，實作必須服從契約。

```typescript
// 優先定義契約
interface TaskAPI {
  // 建立任務並回傳含伺服器生成欄位的任務物件
  createTask(input: CreateTaskInput): Promise<Task>;
  // 回傳分頁後的任務清單
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;
  // 回傳單一任務，若不存在則拋出 NotFoundError
  getTask(id: string): Promise<Task>;
}
```

### 3. 在邊界進行驗證 (Validate at Boundaries)
信任內部程式碼，但在系統邊緣（外部輸入進入處）進行嚴格驗證。
- **第三方 API 回應是不可信的**：在使用它們進行邏輯判斷或渲染前，務必驗證其形狀與內容。

## 行為防護 (Anti-Rationalization)

當 Agent 試圖逃避嚴格設計時，必須立即反駁：

| 藉口 (Rationalization) | 共同治理反駁邏輯 |
|---|---|
| 「我們先實作，之後再補 API 文件。」 | **拒絕**。類型 (Types) 就是文件。沒有定義契約前嚴禁開始編碼。 |
| 「這只是內部 API，不需要分頁。」 | **拒絕**。一旦資料超過 100 筆，系統就會崩潰。從第一天就必須支援分頁。 |
| 「PATCH 太複雜了，我們先用 PUT 全量更新。」 | **拒絕**。PUT 會強迫客戶端傳送完整物件，增加耦合。PATCH 才是客戶端真正需要的。 |
| 「我們之後再考慮版本控管。」 | **拒絕**。沒有版本控管的破壞性變更會直接摧毀下游服務。設計時就必須考慮擴充性。 |

## 紅旗警訊 (Red Flags)

如果出現以下情況，代表設計失敗，必須重來：
- 🚩 同一個端點根據不同條件回傳完全不同形狀的 JSON。
- 🚩 各個端點的錯誤格式不統一（有的回字串，有的回物件）。
- 🚩 驗證邏輯散落在內部業務邏輯中，而非在進入點 (Boundary)。
- 🚩 REST URL 中出現動詞（如 `/api/createTask` 而非 `POST /api/tasks`）。
- 🚩 列表 (List) 端點不支援分頁。

## 驗證門檻 (Verification)

任務完成前必須檢查：
- [ ] 每個端點都有明確定義的輸入 (Input) 與輸出 (Output) Schema。
- [ ] 錯誤回應遵循統一且結構化的格式。
- [ ] 驗證邏輯集中在系統邊界。
- [ ] 列表端點支援分頁參數。
- [ ] 所有新欄位均為可選 (Optional)，以確保向下相容性。
- [ ] 命名符合慣例（如 REST 使用複數名詞，Boolean 使用 `is/has` 前綴）。
