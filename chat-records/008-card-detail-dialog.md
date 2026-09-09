# 對話紀錄 008 — 工單明細窗（CardDetailDialog）與「點卡片開明細」的入口

> 範圍：把 `docs/ui-spec.html` 的工單明細（第二聯）實作成 Vue 元件，並接上規格
> 註一裁示的入口 —— 整張卡片可點。同時推翻了元件內「一律走 Pinia store」的慣性：
> 這張窗直接呼叫 API 層，理由寫在下面。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Session  | `73e6e1b8-aa53-434d-8e20-7bb6c6a4e11e`                             |
| 專案     | `/Users/allen/Desktop/delta-interview`                             |
| 期間     | `09-09 16:27 ~ 17:12`                                              |
| 匯出時間 | `2026-09-09 17:12`                                                 |
| 內容     | 使用者 2 則、選項回答 3 則、Claude 實質回覆 22 則、工具往返約 190 次 |
| 產出     | `CardDetailDialog`（元件 + `const/` + `types/` + 26 項測試）、Card/TaskList/App 的入口串接、`utils/task.ts` 兩個新 formatter；前端測試 214 → 253（新增 39 項） |

---

## 👤 使用者 · 09-09 16:27

我們現在開始實作  卡片詳情

新增一個檔案 components/CardDetailDialog.vue

畫面放在 docs/ui-spec.html裡面的 工單明細

### 🤖 Claude · 16:27 ~ 16:36 — 讀規格、讀既有實作，然後停下來要兩個裁示

**工作歷程**

**1. 讀了哪些東西**

`docs/HANDOFF.md` 全文、`docs/ui-spec.html` 裡工單明細的全部片段（1238–1290 行的
markup、1385–1420 行的規格圖說、685–830 行的 CSS、1887–2000 行的原型 JS，以及註一與
註五）、`.claude/frontend/rules/` 全部七份規則檔，再加上既有的
`TaskDialog`／`DeleteDialog`／`Card`／`TaskList`／`stores/tasks.ts`／`utils/task.ts`／
`api/tasks.ts`。

**2. 停下來的兩個點**

規則 1 說有歧義要請使用者裁示，而這兩個都會實質改變產出：

- 使用者寫的路徑是 `components/CardDetailDialog.vue`（扁平單檔），但 `components/`
  底下每一個元件都是「資料夾 + index.vue + types/ + const/」。扁平 `.vue` 只出現在
  `TaskList/` 內部的子元件（`Card.vue`、`RowMenu.vue`）。
- 「實作卡片詳情」到底含不含入口。規格註一寫「點卡片（整張都可點）開啟唯讀的工單
  明細」，不接入口的話這個功能在畫面上根本進不去；但接入口要動 `Card.vue`、
  `TaskList/index.vue`、`App.vue` 與它們的測試。

Claude 的回覆全文：

> 我已讀完 `docs/ui-spec.html` 的工單明細規格（版型、CSS、開窗順序、註五的四條硬性
> 規則）與現有的 `TaskDialog` / `DeleteDialog` / `Card` 實作。動工前有兩件事會實質
> 改變產出，需要你裁示。

## 👤 使用者 · 16:35（選項回答）

- 檔案結構 → **「照慣例開資料夾（建議）」**
- 實作範圍 → **「連入口一起接（規格的完整功能）」**

### 🤖 Claude · 16:36 ~ 16:54 — TDD 四階段做完，中途在真瀏覽器裡抓到一個 bug

Claude 開工前的回覆全文：

> 讀完了。規格與現有實作都清楚，開始按 TDD 流程做。
>
> **Planning**
>
> - `CardDetailDialog` 唯讀，`defineExpose({ open, close })`，跟另外兩張窗同一套。
> - 開窗順序照註五：手上的 `TaskSummary` 立刻畫滿，只有說明區等 `GET /api/tasks/{id}`。
> - 說明區三態（骨架／內文／失敗＋重試），用一個號碼比對擋掉連點兩張卡與關窗後才回來的回應。
> - 錯誤留在窗裡 → 直接呼叫 `getTask`，不走 `store.fetchTask`（它會寫 `store.error`，把看板橫幅點亮在 modal 後面）。
> - 入口照原型的 stretched link：標題本身是按鈕，`::after` 撐滿整張卡，方框與三點鈕靠 `z-[1]` 浮在上面，不必 `stopPropagation`。

**工作歷程**

**1. Red — 先寫測試**

`src/components/CardDetailDialog/index.spec.ts` 25 項，分五組：先畫再補、說明、
第二聯調不出來、飛在路上的查詢、關閉。跑起來如預期失敗
（`Failed to resolve import "./index.vue"`）。

**2. 資料來源：不走 store，這是本次唯一一個推翻既有慣性的決定**

`stores/tasks.ts` 已經有 `fetchTask`，但它**吞掉錯誤並寫進 `store.error`**。
`App.vue` 用它來做編輯前的預取，那個行為是對的：失敗就不開窗，理由印在看板橫幅上。

但明細窗不能這樣 —— 規格註五明講「錯誤留在窗裡，不走看板那條載入失敗橫幅 ——
橫幅在 modal 後面，人看不到」。用 `fetchTask` 會讓橫幅亮在 modal 背後，而且關窗之後
還留在那裡。

考慮過三條路：

- 在 store 再開一支會 throw 的 action —— 跟 `fetchTask` 幾乎重複。
- 把 `fetchTask` 改成 throw，讓 `App.openEdit` 自己 catch —— 那是改既有元件的行為，
  規則 3 說不要。
- **元件直接呼叫 `@/api/tasks` 的 `getTask`** —— 說明不是看板狀態（store 的清單型別
  是 `TaskSummary`，本來就不含 `description`），這只是一次讀取。

選第三條。有測試綁著這件事：`leaves the board's own failure notice alone`
斷言失敗之後 `useTasksStore().error` 仍是 `null`。

**3. 元件本體**

`index.vue` 用 `ticket` 這個 plain `let` 做請求號碼比對；`open()` 先 `showModal()`
再 `element.focus()`（焦點落在窗本身而不是「關閉」，註五的規則），最後才發查詢。
`open:grid` 而不是扁平的 `grid` —— 後者會蓋掉 UA 的 `dialog:not([open])`，關著的窗
會直接畫在看板上。

`const/card-detail-dialog.ts` 放 `LABELS`、`CATEGORY_NAMES`、`MESSAGES`。

**4. 入口**

`Card.vue` 照原型的做法：標題本身是 `<button>`，`::after { inset: 0 }` 把感應區撐滿
整張卡（stretched link），方框與三點鈕加 `z-[1]`。**沒有在 `<article>` 上掛 click** ——
那會讓那兩顆按鈕變成巢狀互動元素，兩顆都得靠 `stopPropagation` 補救。

`CardEmits` 加 `detail: []`、`TaskListEmits` 加 `detail: [task]`、`App.vue` 掛
`openDetail`。跟 `openEdit` 相反，**明細不先 fetch**：卡片手上那一列已經畫得出六個
欄位。

**5. `utils/task.ts` 加兩個 formatter**

`formatFullDueDate`（明細印完整年份，卡片省年份）與 `formatTimestamp`
（`YYYY-MM-DD HH:mm`）。`無期限` 這個字串抽成 `NO_DUE_DATE` 給兩個 formatter 共用。

`formatTimestamp` 是**字串切片不是 `new Date()`**：後端實際回的是
`2026-09-09T16:11:44.834702+08:00` 這種帶偏移的時間戳，丟進 `Date` 會被重新換算時區，
跟它上面那個不帶時區的 `到期日` 打架。這條有專門的測試綁著。

**6. 瀏覽器驗證（規則要求的 Green 階段），抓到一個真的 bug**

後端已經在跑（使用者自己開的），Claude 自己那次 `spring-boot:run` 因為 8080 被佔用
直接失敗，沒有影響到既有的那個。前端另開 vite。

Playwright 的瀏覽器一開始開不起來，因為 PID 10692 是今日 04:42 由 Playwright 啟動、
已經離線 12 小時的 Chrome 佔住了 profile。這件事**問過使用者才動手**。

跑過的畫面：桌機 1280px、375px、已完成樣式、載入骨架、無說明的 placeholder、
失敗區塊、重試。用 `elementFromPoint` 實測卡片右下角空白處命中的是明細鈕，
方框與三點鈕各自命中自己。

然後就撞到了：**同一輪先關窗、再點另一張卡，說明區會永遠停在載入中。**

原因是瀏覽器的 `close` 事件是**排進佇列而非同步派送**。順序變成
「`close()` → `open()` → 發查詢（ticket = N）→ 晚到的 close 事件 → ticket = N+1」，
新視窗剛發出的查詢被自己上一次的關窗作廢了。

修法是在 `onClose` 加一個 `if (!detailDialogEl.value?.open)`。補了回歸測試
（jsdom 的 `close` 是同步派送的，所以測試要手動模擬那個排隊順序），修完回真瀏覽器
複現一次確認。

**7. 一個被抓回來的不一致**

失敗區塊的「重試」鈕原本寫成 `min-h-6` 且 hover 變實心，跟看板橫幅
（`LoadFailure`）與規格 `.fail button` 的 28px／`4px 9px`／outline hover 不一樣。
已對齊。

**N. 驗證**

| 指令 | 結果 |
| --- | --- |
| `vitest run` | 253 passed / 0 failed（新增 39 項：明細窗 26、Card 4、App 4、utils 4、TaskList 1） |
| `eslint .` | No issues found |
| `vue-tsc --noEmit` | clean |
| `vite build` | 通過 |
| 瀏覽器 1280px / 375px | 無橫向捲軸；窄螢幕標籤與值收成同列，第三格撐滿整列 |
| Esc / 焦點 | Esc 關窗，焦點回到來源卡片；開窗時焦點在窗本身。console 0 errors / 0 warnings |

**踩到的坑（給下一個人）**

`rtk` 包住的 `vitest` 會把終端輸出吃掉，只留 `.vitest/json/output.json`，而**那個檔案
落後一輪**：改完程式碼跑第一次，讀到的是上一輪的結果。中間因此兩度誤判「修好的東西
還在失敗」，多花了幾輪。跑完連跑兩次、或加等待再讀，才是可信的。

## 👤 使用者 · 16:45（選項回答）

- 瀏覽器驗證 → **「終止那個舊行程，繼續驗證（建議）」**

### 🤖 Claude · 16:54 — 交件回覆（全文）

> 做完了，全部驗證通過。
>
> ## 新增
>
> `frontend/src/components/CardDetailDialog/` — 照專案慣例開資料夾：`index.vue`、
> `index.spec.ts`、`const/`、`types/`。對外一樣 `defineExpose({ open, close })`，
> `<dialog>` 自己是「開著沒有」的唯一事實來源。
>
> 規格裡的硬性條件都照做了：
>
> - **先畫再補** — `open(task)` 用手上的 `TaskSummary` 立刻畫滿六個欄位，只有說明區等 `GET /api/tasks/{id}`。
> - **一個號碼比對** — 連點兩張卡、或關窗後才回來的回應都寫不進窗裡。
> - **錯誤留在窗裡** — 失敗區塊 `role="alert"` + 重試，其餘欄位照常可讀。
> - **底下只有「關閉」**，焦點落在窗本身而不是關閉鈕。
> - 已完成換第二聯紙色、抬頭轉印油紫、章蓋在抬頭右邊。
>
> ## 一個決定要跟你講
>
> 明細窗**直接呼叫 `getTask`，沒有走 `tasksStore.fetchTask`**。原因是 `fetchTask`
> 會把錯誤寫進 `store.error`，那會讓看板的載入失敗橫幅亮在 modal **後面**——規格註五
> 明確禁止這件事。這條有測試綁著（斷言 `store.error` 維持 `null`）。
>
> ## 瀏覽器驗證時抓到並修掉一個 bug
>
> 同一輪先關窗、再點另一張卡時，說明區會**永遠卡在載入中**。原因是瀏覽器的 `close`
> 事件是排進佇列而非同步派送，那個晚到的 close 會把新視窗剛發出的查詢作廢。已修掉並
> 補了回歸測試，真瀏覽器複現後確認修復。
>
> ## 入口
>
> `Card.vue` 照原型用 stretched link：標題本身是按鈕，`::after` 撐滿整張卡；方框與
> 三點鈕加 `z-[1]` 浮在上面，兩者是覆蓋層的兄弟節點，**不需要任何
> `stopPropagation`**。已用 `elementFromPoint` 實測卡片空白角落命中明細鈕、方框與
> 三點鈕各自命中自己。代價是卡片文字選不起來（規格自己也寫了這一條）。
>
> ## 驗證
>
> 253 passed / 0 failed、ESLint 無問題、`vue-tsc` clean、`vite build` 通過；
> 瀏覽器 1280px / 375px 無橫向捲軸；載入 / 成功 / 無說明 / 失敗 / 重試逐一跑過；
> Esc 關閉、焦點回到來源卡片正常，console 0 errors / 0 warnings。
>
> ## 兩件我沒動、但你該知道
>
> 1. **`未完成/已完成` 與 `修復/新功能` 現在各有兩份**。前者本來就在
>    `TASK_RACKS[].title` 與 `TaskList/const/card.ts` 重複過了，後者在
>    `TaskDialog/const` 也有一份。統一它們要動到 Card、TaskDialog 與看板那張表，
>    超出這次範圍，所以我照 codebase 既有的「每個元件自帶文案常數」慣例做。
> 2. **`重試` 鈕 28px、`關閉` 鈕 40px**，照規格的 `.fail button` / `.btn` 與現有
>    元件，沒有到 tdd-workflow 寫的 44×44。卡片上的方框仍靠 `::before` 撐到 44px。
>    這是沿用既有裁示，不是漏掉。

---

## 👤 使用者 · 09-09 17:03

請記得 註解有說過 最多兩行, 修改完後 就可以跑 /chat-record

### 🤖 Claude · 17:04 ~ 17:12 — 註解收到兩行，然後補紀錄

**工作歷程**

**1. 用腳本掃，不用眼睛掃**

`coding-style.md` 寫的是「描述內容不要超過2行」。寫了一段一次性的 Python 掃 JSDoc
描述（`@` 標記以後不算）、HTML 註解與連續 `//` 區塊，列出所有超過兩行的位置。
掃出 14 處，其中 **4 處是既有程式碼**（`Card.vue` 的 toggleError 註解、
`Card.spec.ts` 的 beforeEach、`App.vue` 的 `openEdit`、`App.spec.ts` 的標記完成
測試）—— 規則 3 說只清自己的，那 4 處沒動。

`App.vue:82` 其實是掃描器的假警報：`@returns` 換行的續行被算進描述行數了。
確認過之後一併排除。

**2. 改掉自己寫的 10 處**

`index.vue` 5 處、`index.spec.ts` 1 處、`types/card-detail-dialog.d.ts` 1 處、
`Card.vue` 1 處、`utils/task.ts` 1 處、`utils/task.spec.ts` 1 處。最長的兩處各是
6 行（`.facts` 的三個理由、Card 標題按鈕的取捨），壓成 2 行時保留了「為什麼不用
grid」與「為什麼不在 article 掛 click」這兩個最不顯而易見的點。

`index.spec.ts` 有一處是兩段各自合規的註解**貼在一起**被算成 3 行，中間補一個空行
分開，不是刪內容。

**3. 編號撞號**

`chat-records/README.md` 的索引最大是 **006**，照 skill 應該取 007。但
`docs/ui-spec.html` 裡已經有 **5 個 `[AI assisted 007]`** —— 那是上一場對話
（session `deebd4e4`，09-09 15:38 ~ 16:23）把工單明細畫進規格頁時留下的，
**而那次的紀錄檔從來沒寫、索引也沒有那一列**。

沿用 007 會讓規格頁裡那 5 條註解指到一份講別的事情的紀錄，等於毀掉編號的用途。
所以這次用 **008**，007 留成一個缺口，寫在這裡讓它可以被補。

**4. 驗證（改完註解後重跑）**

`vitest run` 253 passed / 0 failed、`eslint .` No issues found、
`vue-tsc --noEmit` clean、`vite build` 通過。

---

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分四類：

| 原因 | 具體內容 |
| --- | --- |
| **把規格翻成實作** | `docs/ui-spec.html` 的工單明細是原生 HTML/CSS 原型，AI 讀出版型、CSS、開窗順序與註五的四條硬性規則，再用 Vue 3 + Tailwind 重寫成 `CardDetailDialog` |
| **解決特定問題** | 「同一輪關窗再開卡片、說明區卡在載入中」這個 bug 是 AI 在真瀏覽器驗證時發現的；`close` 事件排進佇列而非同步派送這件事，是靠實測 + `elementFromPoint` 探測確認的，不是預想 |
| **架構取捨** | 明細窗直接呼叫 `getTask` 而非 `store.fetchTask`（規格註五 vs. 元件慣例的衝突）；stretched link vs. `<article>` click handler；文案常數要不要統一 —— 三個都提了被否決的選項與理由 |
| **產生樣板與測試** | `CardDetailDialog` 的元件／`const/`／`types/`／26 項測試，以及 `Card.spec.ts`、`TaskList/index.spec.ts`、`App.spec.ts`、`utils/task.spec.ts` 的新增案例 |

註解位置：

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `frontend/src/components/CardDetailDialog/index.vue` | `loadDescription()` 上方 | 為什麼直接呼叫 `getTask` 而不走 `store.fetchTask`（`store.error` 會把橫幅點亮在 modal 後面） |
| `frontend/src/components/CardDetailDialog/index.vue` | `onClose()` 上方 | 那個 `if` 是瀏覽器實測抓出來的，不是預想；少了它說明區會永遠停在載入中 |
| `frontend/src/components/CardDetailDialog/const/card-detail-dialog.ts` | `LABELS` 上方 | 文案沒有跟 `TaskList` / `TaskDialog` 合併的理由，以及這是留給日後清理的線索 |
| `frontend/src/components/TaskList/Card.vue` | 標題按鈕的 template | 為什麼選 stretched link 而不是在 `<article>` 掛 click |
| `frontend/src/App.vue` | `cardDetailDialogEl` 上方 | 明細跟 `openEdit` 相反、不先 fetch 的理由 |

未標註的部分：

- `frontend/src/utils/task.ts` 的兩個 formatter、`TaskList/index.vue` 的事件轉發、
  各 `types/` 檔的事件宣告 —— 都是機械性的改動，沒有取捨可記，diff 看得完。
- 測試檔沒標 —— 每個 `it()` 的敘述與它上面的註解本身就在講「為什麼測這件事」。
- `docs/` 與 `chat-records/` 不標註（skill 規定），理由寫在上面的〈工作歷程〉。
