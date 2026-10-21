# 功能與資料契約

## 介面

| 區域 | 教師操作 | 必要提示 |
|---|---|---|
| 左側清單 | 代號搜尋、單一學生或全部學生 | 無符合代號／尚無紀錄 |
| 作答紀錄 | 題目、評分或求助類型、臺北日期篩選；展開程式及問答 | 最後有效成績、原分數／滿分、哪些紀錄不納入 |
| 分析助手 | 三個提問捷徑、自由提問、本機摘要或真AI、取消、新分析 | 本批筆數／日期、最新200筆限制、傳送範圍及費用 |
| 連線設定 | 教師密碼、API金鑰、GAS URL、RECORD_TOKEN、明確清除 | 首次必填項、格式、留白保留、密鑰不读回 |

同一對話固定紀錄id及分析模式。更換學生／篩選／模式、新分析或登出清空對話和草稿；一般更新紀錄保留草稿與對話。取消只停止等待、保留草稿，不自動重送，也不保證上游未計費。登出後尚未完成的回覆不交付。

## API契約

| 路徑 | 輸入／結果 | 存取 |
|---|---|---|
| GET `/api/tutor/status` | initialized、aiConfigured、sheetConfigured；無秘密 | 本機狀態 |
| POST `/api/teacher/settings` | password、aiKey、sheetUrl、sheetToken、clearAi、clearSheet | 首次建立；其後需登入／同來源 |
| POST `/api/teacher/login` | password；只回成功與HttpOnly工作階段cookie | 同來源，失敗限流 |
| POST `/api/teacher/logout` | 清除工作階段 | 已登入／同來源 |
| GET `/api/records` | records、sync | 已登入 |
| POST `/api/records/sync` | sync含pushed、imported、more、lastSyncError | 已登入／同來源；假資料模式拒絕 |
| POST `/api/teacher/analyze` | mode、question、recordIds、history | 已登入／同來源，最多一個分析 |

公開範本不提供未登入的學生寫入API。串接既有學生端時沿用既有紀錄入口；依自己的身分／權限設計，不開放匿名改成績。範本讀寫自己的 `local-data/records/events.jsonl`，使用者可透過後端 `recordStore.save(record)` 或原系統轉接匯入，並以 `cleanRecord` 驗證。

校內學生端由原教學程式提供；[區網工具與接線](school-lan.md) 保存單一IPv4／埠號、啟動前核對目前網卡，預設只開放學生端。本教師API表仍只適用loopback；不可由區網轉送教師路由。區網轉接使用專案自己的學生路由白名單、限流及教師隔離，不是新增匿名教師API。

## 紀錄

id為8～80字ASCII英數、底線或連字號；studentId為1～40字英數／中文字、底線或連字號。type為grade或ai，status為completed或failed。task包含code、title；timestamp為有效日期字串，請使用標準UTC ISO格式。program為 `{targets:[{name, isStage, blocks, variables, lists}]}`；是結構快照，不包含完整執行環境。

評分紀錄有totalScore、maxScore、demoLoaded、programChanged。只有completed且不是範例／變動才採分。求助紀錄有source（mock或live，live代表真實AI服務）、question、guidance、followup。不同服務應在轉接時明確分開模擬／真實來源。

保存順序是同時間戳的次序依據。列表倒序；最後有效成績以時間正序、同時刻保存序遍歷。不同題目不相加／換算成未定義的全班排名。範本用臺北時間顯示／日期篩選；其他地區在日期鍵和顯示兩處一起調整。

## 分析結果

```json
{
  "observations": [{"text": "直接觀察", "recordIds": ["demo-grade-0001"]}],
  "interpretations": [{"text": "待教師確認的推測", "recordIds": ["demo-grade-0001"]}],
  "suggestions": [{"text": "教師可採取的小步引導", "recordIds": []}],
  "limitations": ["只分析所選紀錄，部分程式可能被摘要截斷"]
}
```

觀察／推測必須引用本批id；建議可無引用。後端驗證格式、引用及長度，避免輸出已保存秘密。這些檢查不能證明推測為真；教师仍需核對原紀錄。

## 憑證規則

公開範本RECORD_TOKEN為8～200碼（JS字串長度），不附預設token；教師頁、後端、GAS需設同一個值。教師登入密碼12～256字；API key為8～512個可見ASCII字元。API key只檢查格式，不證明服務接受。GAS URL僅接受 `https://script.google.com/macros/s/部署代碼/exec`，URL与token一起設。留白保留，勾選清除則清空；token和金鑰永不從狀態API讀回。
