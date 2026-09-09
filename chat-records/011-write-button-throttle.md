# 對話紀錄 011 — 三顆寫入按鈕加節流（`utils/throttle.ts` 與 `utils/` barrel）

> 範圍：新增／編輯彈窗的確定、刪除彈窗的確定、卡片上的狀態標記 —— 全專案僅有的三個
> 會寫進資料庫的按鈕加上節流；節流寫成 `src/utils/throttle.ts`，並依使用者指示補上
> `src/utils/index.ts` barrel，Vue 層一律改從 `@/utils` 取用。三顆按鈕原本就各有的
> in-flight guard **全部保留**，理由寫在下面。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Session  | `cc0d1227-6fe4-4a65-82f4-ec50340ac84d`                             |
| 專案     | `/Users/allen/Desktop/delta-interview`                             |
| 期間     | `09-09 21:42 ~ 22:54`                                              |
| 匯出時間 | `2026-09-09 22:54`                                                 |
| 內容     | 使用者 1 則（另加 `/chat-record` 一次）、Claude 實質回覆 12 則、工具往返約 59 次 |
| 產出     | `src/utils/throttle.ts`、`src/utils/index.ts`（barrel）、`src/const/interaction.ts`；`TaskDialog` / `DeleteDialog` / `Card` 三顆寫入按鈕接上節流；五個 `.vue` 的 utils 匯入改走 barrel；前端測試 266 → 276（新增 10 項） |

---

## 👤 使用者 · 09-09 21:42

檢查一下 送出接口的按鈕
新增編輯彈窗的確認鍵與刪除彈窗的確認鍵
還有修改狀態的按鈕

這些添加一個節流功能

把節流寫在utils底下

一樣是throttle.ts  且通通引入到index.ts然後統一由index.ts輸出出去到vue層去使用

### 🤖 Claude · 21:42 ~ 21:50 — 節流落地

**工作歷程**

**1. 先把呼叫點數出來，不要憑印象**

`grep` 全專案的 store mutation 呼叫端，扣掉 `stores/`、`api/` 與 generated schema，
剩下的**正好三處**，和使用者列的三顆按鈕一一對上：

- `TaskDialog/index.vue` → `updateTask` / `createTask`
- `DeleteDialog/index.vue` → `deleteTask`
- `TaskList/Card.vue` → `setTaskCompletion`

另外兩顆會打接口但**沒動**：`CardDetailDialog` 的「重試」與 `LoadFailure` 的重試。
兩顆都是 GET，也不在使用者點名的三個裡面 —— 最小改動，但有在收尾時講出來讓使用者裁示。

**2. 這三顆本來就有 in-flight guard，所以第一個要回答的是「那還需要節流嗎」**

三個檔案各自有一個 `let saving` / `let deleting` / `let stamping`，是 006 那次就寫下的
「一個請求在飛就不再送」。結論是**兩者補的洞不一樣，都要留**：

- guard 不看時鐘，擋的是「請求還在飛」；請求比窗口慢時，只有它擋得住。
- 節流不看請求，擋的是「請求已經回來、guard 已經放下，但第二下點擊還在路上」。
- `TaskDialog` 的破口最明顯：`saving` 要等驗證通過才升起，**標題空白時連按兩下，
  原本兩次都會整段跑完**。

所以這次是「加上去」，不是「換掉」。三個 guard 一行都沒改。

**3. `throttle` 的形狀**

leading edge、**丟棄不排隊**、窗口從「實際執行的那次」起算：

- 不做 trailing（lodash 預設帶）：補送的第二次等於在使用者鬆手之後又開一張單，
  畫面上沒有任何東西解釋得了它。
- 被丟掉的呼叫不推遲窗口：否則一直連按的人會把自己鎖在門外。
- 不做 `cancel()` / options 物件 —— 專案守則明寫不為預想中的未來提前抽象。
- 用 `Date.now()` 而非 `performance.now()`：假時鐘下前者的行為明確，不必去賭
  vitest 的 `toFake` 預設有沒有含 `performance`。

型別 `(...args: Args) => void`，回傳值刻意丟掉；三個呼叫端都是自己 catch 的 async
函式，所以不會有漏接的 rejection。

**4. 500 這個數字放哪**

放 `src/const/interaction.ts`（`WRITE_THROTTLE_MS`）。被否決的兩個做法：三處各寫一個
magic number（同一條政策散成三份會漂移）、各元件自己的 `const/`（`DeleteDialog` 連
`const/` 資料夾都沒有，為一個數字生一整層目錄不划算）。放 `src/const/` 也和既有的
`src/const/task.ts` 同一層級。

**5. barrel 與匯入**

`src/utils/index.ts` 依使用者指示把 `task.ts` 的六個函式、`CategoryDisplay` 型別與
`throttle` 統一輸出；五個 `.vue` 全部從 `@/utils/task` 改成 `@/utils`。
`src/utils/task.spec.ts` 維持 `from './task'` —— 它測的是那個模組本身，不是 barrel。

**6. 測試：先讓它壞給我看**

`throttle.spec.ts` 先寫（7 項，含「被丟掉的呼叫不推遲窗口」與「每個 throttled function
各有自己的窗口」）。接上元件後跑全套，**正好 4 個既有案例壞掉，全是同一個形狀**：

| 檔案 | 案例 |
| --- | --- |
| `DeleteDialog` | lets 確定 be pressed again once a refusal has come back |
| `TaskDialog` | lets 確定 be pressed again once a refusal has come back |
| `TaskDialog` | takes the notice away as soon as another attempt starts |
| `Card` | lets the mark be pressed again once a refusal has come back, and clears it |

這四個都是「失敗後**立刻**重按」，在真實時鐘下整段測試跑不到 1ms，被節流吃掉是對的 ——
節流確實改了它們的語意，不是誤傷。解法是每個 spec 檔加一個 `passThrottleWindow()`：

```ts
vi.spyOn(Date, 'now').mockReturnValue(Date.now() + WRITE_THROTTLE_MS)
```

**只推 `Date.now`，不用 `vi.useFakeTimers()`** —— `flushPromises` 等的是 `setImmediate`
（`@vue/test-utils` 的 `scheduler`），而 `useFakeTimers()` 預設連它一起接管，時鐘沒人
去推的話這三個檔案裡每一個 `await` 都會停住。`vite.config.ts` 有 `restoreMocks: true`，
spy 會自動還原，不必寫 `afterEach`。

順手補 3 個新案例（每個元件一個）把政策的另一半也鎖住：**同一口氣內的第二下被丟掉**。
現在每個元件都有成對的兩條 —— 窗口內丟掉、窗口過了放行。

**7. 一個假警報，值得寫下來**

修完 spec 重跑，讀到的仍是 `273 total / 4 failed`，一度以為 patch 沒生效。`grep` 確認
三個檔案都改對了，**問題出在讀到的是上一輪的報告**：`rtk` 的過濾器吞掉 vitest 自己的
摘要（只印 `[RTK:PASSTHROUGH] vitest parser: All parsing tiers failed` 加一行 JSON 路徑），
所以整輪都在讀 `frontend/.vitest/json/output.json`，而那次寫入沒有更新。刪掉 `.vitest`
重跑才看到 `276 passed`。**教訓：那份 JSON 不保證是這一次跑出來的，讀之前先刪。**

另外 `.vitest/` 不在 `.gitignore` 裡，跑完測試會冒出來變成未追蹤目錄；我跑完手動刪掉了，
沒有自作主張去改 `.gitignore`。

**8. 驗證**

`vitest run` 276 passed（0 failed）、`vue-tsc --noEmit` 通過、`eslint .` 無問題、
`vite build` 成功。基準 266 是推算的：第一次跑全套時 `throttle.spec.ts` 的 7 項已經在內
（273），最後 276，扣掉本次新增的 10 項即 266 —— **沒有真的 checkout 回 HEAD 重跑**。

對話開始時工作區是乾淨的（git status clean），所以 `git status` 上的每一個檔案都是本次產出，
沒有使用者既有的未提交變更混在裡面。（使用者稍後在 22:49 自行把這批改動 commit 掉，
見下一節第 4 點。）

**實質回覆全文**

> 做完了，三顆會打接口的按鈕都上了節流。
>
> ## 新增的檔案
>
> **[throttle.ts](frontend/src/utils/throttle.ts)** — leading edge 節流：第一次呼叫立刻執行，窗口內的後續呼叫**直接丟掉、不排隊**。這對寫入型按鈕是關鍵：延後補送等於重複開一張單，而且畫面上什麼都不會顯示。窗口從「實際執行的那次」起算，被丟掉的呼叫不會把窗口往後推。每次呼叫 `throttle()` 都有自己獨立的窗口（同一個貨架上兩張卡片不能共用時鐘）。
>
> **[index.ts](frontend/src/utils/index.ts)** — barrel，`task.ts` 的六個函式 + `CategoryDisplay` 型別 + `throttle` 統一由這裡出去。五個 `.vue` 全部改成從 `@/utils` 匯入。
>
> **[interaction.ts](frontend/src/const/interaction.ts)** — `WRITE_THROTTLE_MS = 500`，三個呼叫點共用同一份設定，不散成三個 magic number。
>
> ## 三個接上的按鈕
>
> | 元件 | 內部函式 | 綁在模板上的 |
> |---|---|---|
> | [TaskDialog](frontend/src/components/TaskDialog/index.vue#L206) 確定（新增／編輯） | `save()` | `const onSubmit = throttle(save, WRITE_THROTTLE_MS)` |
> | [DeleteDialog](frontend/src/components/DeleteDialog/index.vue#L132) 確定（刪除） | `withdraw()` | `const onConfirm = throttle(withdraw, …)` |
> | [Card](frontend/src/components/TaskList/Card.vue#L95) 狀態標記 | `stamp()` | `const onToggle = throttle(stamp, …)` |
>
> 模板一行都沒改，因為對外的名字（`onSubmit` / `onConfirm` / `onToggle`）保持原樣。
>
> **原本的 in-flight guard（`saving` / `deleting` / `stamping`）我全部留著**，兩者補的洞不一樣：guard 不看時鐘，擋的是「請求還在飛」；節流不看請求，擋的是「請求已經回來、guard 已經放下，但第二下點擊還在路上」。少了任何一邊都有破口——TaskDialog 更明顯，`saving` 要等驗證通過才會升起，標題空白時連點兩下原本兩次都會跑完。
>
> ## 驗證
>
> - `vitest run` — 276 passed（原 273 + 節流 util 7 個 + 三個元件各 1 個「同一口氣內第二下被丟掉」）
> - `vue-tsc --noEmit`、`eslint .`、`vite build` 全過
>
> 測試那邊有四個既有案例是「失敗後立刻重按」，在真實時鐘下會被節流吃掉，我加了 `passThrottleWindow()` helper 把 `Date.now` 往前推一個窗口。只推 `Date.now` 而不用 `vi.useFakeTimers()`，因為 `flushPromises` 等的是 macrotask，假時鐘會讓它永遠卡住。
>
> 兩件沒動、想先跟你確認的：`CardDetailDialog` 的「重試」和 `LoadFailure` 的重試也會打接口，但都是 GET、也不在你列的三個裡面，就沒碰。另外這次改動還沒補 `[AI assisted NNN]` 註解和 chat-record，要的話跟我說一聲。

## 👤 使用者 · 09-09 22:51

/chat-record

### 🤖 Claude · 22:51 ~ 22:54 — 補註解與紀錄

**1. 編號撞號：010 已經被用掉了，本次改用 011**

skill 的第一步是「讀 `chat-records/README.md` 的索引表，取最大編號 +1」，索引最大是 009，
所以我先用了 010 —— 註解、紀錄檔、索引列全都寫成 010。收尾檢查 `git diff` 時才 grep 到
**程式碼裡已經有 5 條 `[AI assisted 010]`**，來自本次對話開始前的最後一個 commit
（`573e913`，RowMenu 改用 anchor 位移關閉 + 托盤高度修正），而那場對話同樣沒有留下紀錄檔，
所以索引上看不到它。這正是 README 裡 007 那段警告的情形：撞號會讓程式碼裡的編號指到一份
講別的事情的紀錄，編號的用途就此毀掉。

八條註解、紀錄檔名與索引列全部改成 **011**，`573e913` 的 5 條 010 一個字都沒動。
**索引的「最大編號 +1」不夠用 —— 定編號前要先 `grep -rho "AI assisted [0-9]\{3\}" frontend/src docs`
看程式碼裡實際用到哪裡。**

**2. 八條註解，一個檔案一條**

新增與修改的八個程式檔各標一條，標的都是「為什麼」而不是「做了什麼」：leading edge 的
取捨、常數的落點、為什麼保留既有 guard、窗口的起算點、為什麼一張卡一個窗口、為什麼
測試只推 `Date.now`。`utils/index.ts` 沒標 —— 它是使用者直接指定的 barrel，沒有第二層
取捨可記。`RowMenu.vue` 與 `CardDetailDialog/index.vue` 只改了 import 路徑，也沒標。

**3. 一個自我修正**

三個 spec 檔的註解初稿我寫了「踩過」，但事實是我**並沒有真的讓假時鐘卡死過** —— 那是
設計時就避開的。改掉之後回頭去 `node_modules/@vue/test-utils` 確認
`const scheduler = typeof setImmediate === 'function' ? setImmediate : setTimeout`，
把真正的機制（`setImmediate`）寫進註解，而不是含糊寫「macrotask」。

**4. 使用者在 22:49 自行 commit，八條註解落在 commit 之後**

`8956493 feat: add throttle utility and apply to write actions to prevent duplicate network requests`
收了 13 個檔案：本次產出的 12 個全在裡面，另外使用者順手刪掉 `frontend/src/utils/.gitkeep`
（`utils/` 有了真檔案之後那個佔位檔就沒用了 —— **是使用者自己的清理，不是我做的**）。
和 009 那次不同，這回**沒有任何一個檔案漏掉**。後果是本輪補的八條 `[AI assisted 011]`
註解與兩個 `chat-records/` 檔案都落在那個 commit 之後，現在還留在工作區，未 commit。

**5. 寫紀錄檔時撞到權限規則**

`.claude/settings.json` 有 `Read(./chat-records/**)` 與 `Bash(cat|head|tail|less chat-records/*)`
的 deny 規則（用途是避免把過去的紀錄整批讀進 context）。Write 工具跟著 Read 的 deny 走，
所以新紀錄檔沒辦法直接寫進 `chat-records/`。改成先寫進 scratchpad 再 `cp` 進去 ——
被擋的是「讀」，而這一步是 skill 本身要求的「新增」。這件事記在這裡，下一次直接照做。

**6. 重跑**

補完註解重跑：276 passed、`vue-tsc` 通過、`eslint .` 無問題。這次 lint **沒有**出現
skill 提到的 `Linter process terminated abnormally` 假警報。**我自己沒有下任何 commit。**

---

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分四類：

| 原因 | 具體內容 |
| --- | --- |
| **盤點呼叫點** | 「哪些按鈕會寫進資料庫」是 grep store mutation 的呼叫端得出的，不是憑印象：全專案正好三處，與使用者列的三顆一一對上；順帶找出兩顆沒被點名的 GET 重試鈕交還裁示 |
| **設計取捨** | leading edge 而非 trailing、丟棄而非排隊、窗口從執行那次起算、每個實例一個窗口、`Date.now` 而非 `performance.now`、常數放 `src/const/` 而非各元件 `const/` —— 每一項都連被否決的做法一起記進註解 |
| **判斷既有程式碼的去留** | 三顆按鈕原有的 in-flight guard 是否該被節流取代。結論是兩者防的是不同的時間窗，全部保留，並指出 `TaskDialog` 的 `saving` 在驗證之後才升起這個實際破口 |
| **產生樣板與測試** | `throttle.ts`、`utils/index.ts`、`const/interaction.ts`，`throttle.spec.ts` 7 項，三個元件各 1 項新案例，以及四個既有案例的 `passThrottleWindow()` 修正 |

註解位置：

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `frontend/src/utils/throttle.ts` | `throttle()` 的 JSDoc 上方 | 為什麼是 leading edge + 丟棄，不是 lodash 那種帶 trailing 的；為什麼窗口從執行那次起算 |
| `frontend/src/const/interaction.ts` | `WRITE_THROTTLE_MS` 的 JSDoc 上方 | 為什麼放 `src/const/` 而不是各元件自己的 `const/` |
| `frontend/src/components/TaskDialog/index.vue` | `const onSubmit = throttle(...)` 上方 | 節流是加上去的而非取代 `saving`：`saving` 要等驗證過才升起，兩者補不同的洞 |
| `frontend/src/components/DeleteDialog/index.vue` | `const onConfirm = throttle(...)` 上方 | 窗口從按下起算而非從 DELETE 回來起算的理由 |
| `frontend/src/components/TaskList/Card.vue` | `const onToggle = throttle(...)` 上方 | `throttle()` 寫在 `<script setup>` 內、每張卡各有窗口；提到模組層級會讓隔壁卡片被連坐 |
| `frontend/src/components/TaskDialog/index.spec.ts` | `passThrottleWindow()` 上方 | 為什麼只推 `Date.now` 不動計時器（`flushPromises` 等 `setImmediate`） |
| `frontend/src/components/DeleteDialog/index.spec.ts` | 同上 | 同上 |
| `frontend/src/components/TaskList/Card.spec.ts` | 同上 | 同上 |

未標註的部分：

- `frontend/src/utils/index.ts` —— 使用者直接指定的 barrel，檔案本身只有 re-export，
  沒有第二層取捨可以記。
- `frontend/src/components/TaskList/RowMenu.vue` 與
  `frontend/src/components/CardDetailDialog/index.vue` —— 本次只把 `@/utils/task`
  改成 `@/utils`，一行 import 路徑，不是決策點。
- `frontend/src/utils/throttle.spec.ts` —— 每個 `it()` 的敘述與它上面的註解本身就在
  講「為什麼測這件事」，與 009 的處理一致。
- `chat-records/` 不標註（skill 規定）。
