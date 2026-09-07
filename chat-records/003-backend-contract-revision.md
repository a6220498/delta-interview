# 對話紀錄 003 — 後端契約修訂：工單編號、category、dueDate

> 範圍：實現階段的第一次契約變更 —— UI 與後端資料對不起來，使用者提出五點要求，
> 逐點分析後修訂 `api/openapi.yaml` 並同步後端、前端型別與文檔。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                          |
| -------- | -------------------------------------------------------- |
| Session  | `ee84708a-d27b-4300-ba0c-53c51847fff8`                   |
| 專案     | `/Users/allen/Desktop/delta-interview`                   |
| 期間     | 09-08 00:54 ~ 01:16                                      |
| 匯出時間 | 2026-09-08 01:16                                         |
| 內容     | 使用者 3 則（含 1 次選項回答）、Claude 5 則、工具往返約 28 次 |
| 產出     | 契約新增 1 個 enum + 3 個欄位；後端測試 8 → 15；README 與設計文檔同步 |

---

## 👤 使用者 · 09-08 00:54

我們來討論一下並修改後端的契約
UI跟後端目前有些資料對不起來
1. 卡片id這塊不變, 一樣用uuid, 但是要新增兩個欄位一個category 只給bug || feat, 到時候我會請UI在新增與編輯工單時, 會多一個下拉, 可以選擇category欄位, 至於後面的0000, 就是流水號可以給number, 前端這邊自己補滿四位數就好, 切記一件事, bug跟feat的流水號是分開的,這部分麻煩你修改一下openAPI
2. description這塊我之後會請ui補, 所以openAPI這邊需要添加description
3. title 一樣與openAPI限定1-200字, 只是UI不顯示, 只要在輸入超過文字時,驗證沒過才會跳出錯誤提示
4. 完成端點 這邊確實要跟openAPI一樣加個completion, 但如果未完成是否也要加一個呢?因為可能會有完成變回未完成的可能性。
5. dueDate這部分能否openAPI那邊多開一個欄位存到期日?

以上這五點你分析一下,如果有問題請繼續詢問我, 沒問題的話請開始實作, 並記得更新Readme與相關的後端文檔。

### 🤖 Claude · 09-08 00:54 ~ 00:56 — 讀專案並逐點分析

讀 `api/openapi.yaml`、`backend/` 全部原始碼與測試、`frontend/src/api` 與 `types`、
`README.md`、`docs/HANDOFF.md`、`docs/ui-spec.html` 05 節。工作區乾淨，無使用者未提交的變更。

分析結果：**五點裡只有兩點真的要動契約**。

**1. category + 流水號 → 要改，而且推翻既有裁示**

`docs/ui-spec.html` 05 節與 `HANDOFF.md` 當時寫的是：`id` 本身就是工單編號（`bug-0012`
這種字串），而且兩個類別**共用一個計數器**。使用者這次的要求是 `id` 維持 uuid、另外開
`category` 與流水號兩個欄位、且兩類別**分開計數**。這是把「人看的編號」跟「機器用的 id」
拆開，比原方案好，但有一個副作用必須先裁示。

**2. description → 契約裡已經有了，不用改**

`Task` / `CreateTaskRequest` / `UpdateTaskRequest` 三個 schema 都已經有 `description`
（≤ 2000 字、nullable）。缺的只是 UI 還沒接上去。

**3. title 1–200 → 契約裡也已經有了，不用改**

`minLength: 1, maxLength: 200` 已在契約中，後端拿到產生出來的 `@Size`，違反直接回 400
problem details。「畫面不顯示字數、只在超出時跳錯」是純前端行為，不影響契約。

**4. 未完成端點 → 不建議另開**

`PATCH /api/tasks/{id}/completion` 帶的是**目標狀態**而不是 toggle，所以
`{"completed": false}` 本身就是「完成改回未完成」，後端測試 `canReopen` 已經蓋住這個情境。
另開一支 `/incompletion` 會讓同一件事有兩個入口，而且把原本 idempotent 的設計退回成
連點兩次會 race 的 toggle 語意。

**5. dueDate → 要加**

`format: date`（無時間、無時區）、選填 nullable，`Task` / `Create` / `Update` 都加。
逾期判斷留前端（`dueDate < 今天 && !completed`），後端不回 overdue 旗標 —— 這是 ui-spec
已經定的。

### 🤖 Claude · 09-08 00:56 — 詢問唯一的阻塞決策

**Q. 流水號改成「bug / feat 各自一組」之後，編輯工單把類別從 feat 改成 bug 時，流水號要怎麼處理？**

舊方案兩類別共用一個計數器，號碼本身就唯一，所以不會有這個問題；改成分開算之後，
號碼只在同類別內唯一 —— `feat-0003` 搬到 `bug`，就可能跟既有的 `bug-0003` 撞號。

- **重新發號（建議）** — 從目標類別的計數器取新號，`feat-0003` → 例如 `bug-0007`。
  畫面上的編號永遠唯一。原本「不換號」的理由是換號會讓網址 404，但 `id` 現在是 uuid、
  路由用 uuid，這個理由已經不存在。代價是使用者記的號碼會變。
- **號碼永不改** — 維持 `HANDOFF.md` 既有的「發下去後永不重發」。代價是顯示編號不再唯一，
  可能兩張卡片都印 `bug-0003`。
- **類別建立後不可改** — 號碼絕對穩定，但與「編輯時也要有下拉」的需求衝突。

## 👤 使用者 · 09-08 00:56（回答）

**重新發號（建議）**

### 🤖 Claude · 09-08 00:56 ~ 01:10 — 工作歷程

**1. 契約（`api/openapi.yaml`）**

新增 `TaskCategory` enum（`bug` / `feat`）。刻意用封閉 enum 而不是自由字串：兩個值是領域的
固定組成，enum 讓未知值在邊界上就變成 400，而不是進到系統裡變成一張畫不出來的卡片。

`Task` 加三個欄位：

- `category`（必填）
- `sequence`（必填，`int32` ≥ 1，伺服器產生）—— 契約走原始整數，補零四位是前端的顯示責任
- `dueDate`（`format: date`，選填 nullable）

`CreateTaskRequest` 與 `UpdateTaskRequest` 加 `category`（必填）與 `dueDate`。
`sequence` **刻意不進任何 payload**：客戶端因此沒有辦法自己編一個已經有人在用的號碼。

`PUT` 的 `description` 補上重新發號的規則與理由。

**2. 後端**

`TaskRepository` 改用「每個 category 一個 `AtomicInteger`」的發號機制。計數器放在建構時
填滿、之後只讀的 `EnumMap` 裡 —— `final` 欄位的安全發佈保證讀取安全，計數本身則由
`AtomicInteger` 負責，Spring 執行緒池下不需要額外同步。

`update()` 的關鍵是**判斷與寫入必須在同一個原子區段內**：在 `computeIfPresent` 的 lambda
裡先讀舊 `category`、決定「保留原號」或「從目標計數器取新號」，再一次寫回。若把判斷移到
外面，讀舊類別與寫新號碼之間就會出現空隙。

`TaskController` 只是把新欄位轉交給 repository，發號邏輯刻意不外洩到 controller。

**3. 測試（8 → 15）**

既有 8 個測試的建立呼叫都補上 `category`。順手把 `rejectsBlankTitle` 的 payload 也補上
`category` —— 否則那個測試會因為「缺 category」這個錯誤理由通過。

新增 7 個：

- `rejectsMissingCategory` / `rejectsUnknownCategory` — 必填與 enum 範圍
- `serialsAreCountedPerCategory` — 中間插兩張 feat 不會推進 bug 計數器
- `storesDueDate` — 純日期原樣往返
- `movingCategoryReissuesTheSerial` — 改類別重新發號且 `id` 不變
- `sameCategoryKeepsTheSerial` — 同類別存檔號碼不變
- `omittedFieldsAreCleared` — PUT 是整批取代，省略 `description` / `dueDate` 等於清空

一個實際踩到的陷阱：所有測試共用同一個 Spring context，計數器會跨測試累積，所以
**不能斷言「第一張 bug 是 1」** —— 那只有在該測試剛好第一個跑時才成立。所有流水號斷言
都改成拿同一個測試裡讀回來的號碼做相對比較（`secondBug == firstBug + 1`），並把這個理由
寫進 class javadoc。

**4. 前端**

`types/task.ts` 補上 `TaskCategory` 的重新匯出。`tasks.spec.ts` 的測試替身補上三個新欄位，
並改用 `satisfies Task` 綁住契約 —— 契約日後再加欄位，這裡會直接型別檢查失敗，而不是讓
假資料默默失真（這次就是這樣才發現替身要改）。

**5. 文檔**

`README.md` 補上〈工單編號：category + sequence〉與〈dueDate 與逾期〉兩節、更新 `Task`
欄位表與 payload 表、把「兩個刻意的設計決定」擴成三個。

`docs/HANDOFF.md` 與 `docs/ui-spec.html` 05 節裡的舊決策（`id` 就是 `bug-0012`、共用計數器、
永不重發）改寫成新版，並加一段註明 2026-09-08 這次修訂推翻了哪兩條、為什麼舊理由不再成立。

**6. 驗證**

`mvn test` 15 passed、`pnpm backend:build` BUILD SUCCESS、`pnpm test` 9 passed、
`vue-tsc` 乾淨、`vite build` 成功、ESLint 0 issues。

另外起一台實機打過一輪。過程中發現 **port 8080 已被佔用** —— 是使用者當天 14:42 自己啟動的
舊版後端（PID 35909）。沒有動它，改用 8081 驗證：`bug` 與 `feat` 各自從 1 開始、中間插兩張
feat 不會推進 bug 計數器、`feat-0002` 改 bug 變成 `bug-0003` 而 `id` 一字未改、
`chore` / 缺 category / 201 字標題 / 壞日期全部 400。

### 🤖 Claude · 09-08 01:10 — 完成回報

三件要注意的事：

1. **使用者自己那台後端還開著，而且是舊契約**（PID 35909, port 8080）。要用新契約得重啟。
2. **`docs/` 在 `.gitignore` 裡**（`.gitignore:27`），所以 `HANDOFF.md` 與 `ui-spec.html`
   的修改只在磁碟上，不會進 commit。`HANDOFF.md` 是給新 session 的交接文件卻不進版控。
3. **這是破壞性契約變更**：`category` 現在是 POST / PUT 的必填欄位，舊的 `{"title":"..."}` 一律 400。

兩件刻意沒做：前端補零四位的 helper（`components/` 目前還是空的，沒有呼叫端，只把規則寫進
文檔）；`GET /api/tasks` 的 `category` 篩選參數（看板只依 `completed` 分兩架，分類是上色用的）。

另外 `pnpm lint` 用預設 heap 會 OOM，`NODE_OPTIONS=--max-old-space-size=4096` 之下乾淨過 ——
與本次改動規模不相稱，看起來是既有的環境問題。

## 👤 使用者 · 09-08 01:12

把你剛剛改的東西依照以下規定 添加註解 並新增對話紀錄到chat-records

如果你使用 AI，請：
1. 在相關程式碼區段加入註解，例如 `// [AI assisted {chat-number}]`
2. 簡要說明你使用 AI 的原因，例如查詢 API 用法、產生樣板程式碼，或解決特定問題，並將你的對話紀錄存放在以該對話編號命名的資料夾中。

### 🤖 Claude · 09-08 01:12 ~ 01:16 — 補註解與對話紀錄

`chat-records/` 原本用描述性檔名、沒有編號。依時間順序定編號並補上
[`README.md`](./README.md) 索引：001 = `screen-design`、002 = `project-init`、
003 = 本次。

一開始沒有改既有兩份的檔名（判斷不在當時的任務範圍），使用者隨後要求補上編號前綴，
因此以 `git mv` 改成 `001-screen-design.md` / `002-project-init.md`，git 認得是 rename、
歷史沿用同一條線。兩份的**內文沒有動**：裡面提到舊檔名的地方是當時的對話內容，
改掉等於竄改紀錄；只修了 002 開頭那個指向 001 的實際連結。

本次改動的程式碼區段加上 10 處 `[AI assisted 003]`（6 個檔案），見下方〈AI 協助的範圍與原因〉。

---

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分三類：

| 原因 | 具體內容 |
| --- | --- |
| **解決特定問題** | 兩個計數器獨立之後，改類別沿用舊號會撞號 —— 這個副作用是分析契約時由 AI 指出的，並整理成三個選項（重新發號／號碼永不改／類別不可改）連同 trade-off 交給使用者裁示 |
| **設計併發正確的實作** | 發號機制的執行緒安全（`EnumMap` + `AtomicInteger` 的安全發佈）、以及「判斷該不該重新發號」必須放在 `computeIfPresent` 的原子區段內 |
| **產生樣板與測試** | 契約 schema、controller 的欄位轉交、7 個新測試，以及 README / HANDOFF / ui-spec 的同步改寫 |

註解位置：

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `api/openapi.yaml` | `components.schemas` 開頭 | 工單編號的契約形狀（id 維持 uuid、編號改由 category + sequence 組成）與 dueDate |
| `api/openapi.yaml` | `PUT /api/tasks/{id}` 的 `description` | 改類別重新發號規則的推導過程 |
| `backend/.../TaskRepository.java` | `sequencesByCategory` 欄位 | 每個 category 一個獨立計數器的發號機制與執行緒安全性 |
| `backend/.../TaskRepository.java` | `update()` 內的發號判斷 | 把判斷放進 `computeIfPresent` 原子區段的理由 |
| `backend/.../TaskController.java` | `createTask()` / `updateTask()` | 新欄位的轉交 |
| `backend/.../TaskControllerTest.java` | `Create` 與 `Update` 兩處新測試區塊 | 7 個新測試各自鎖住的承諾 |
| `frontend/src/types/task.ts` | `TaskCategory` 匯出 | 契約新型別的重新匯出 |
| `frontend/src/api/tasks.spec.ts` | `sampleTask` 測試替身 | 改用 `satisfies Task` 綁住契約的理由 |

未標註的部分：`README.md`、`docs/HANDOFF.md`、`docs/ui-spec.html` 是文檔而非程式碼，
改寫內容與理由記錄在本檔〈工作歷程〉第 5 點。
