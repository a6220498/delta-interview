# 對話紀錄 009 — 375px 版型：架別切換（RackSwitch）與右下角浮動鈕

> 範圍：把 `docs/ui-spec.html` 03 節「375px 與無障礙」缺的兩條版型規則實作出來 ——
> 手機版一次只看一架的分段切換，以及取代標題列按鈕的浮動鈕。03 節其餘的無障礙條款
> （方框可按的鍵盤等價、44px 命中區、原生 popover 與 `<dialog>`）在 006 / 008 已經落地，
> 本次只補版型。中途使用者自行 commit（`b9624e0`），過程與後果寫在下面。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Session  | `d356bb5c-9285-4ca2-bad4-40b240417ca9`                             |
| 專案     | `/Users/allen/Desktop/delta-interview`                             |
| 期間     | `09-09 17:17 ~ 20:55`                                              |
| 匯出時間 | `2026-09-09 20:56`                                                 |
| 內容     | 使用者 3 則、選項回答 4 則、Claude 實質回覆 11 則（其中 2 則是 session limit 中斷訊息）、工具往返約 111 次 |
| 產出     | `RackSwitch`（元件 + `types/` + 6 項測試）、`MainLayout` 手機浮動鈕（+3 項測試）、`App.vue` 架別狀態與托盤顯示切換（+3 項測試）；前端測試 253 → 265（新增 12 項） |

---

## 👤 使用者 · 09-09 17:17

docs/ui-spec.html

分析一下， 這是我與其他session討論出來的畫面呈現

現在下方的375的頁面這塊  似乎沒有做到, 你分析完之後 該如何做與我討論 之後開始實作

### 🤖 Claude · 17:17 ~ 17:22 — 讀規格、比對實作、量現況，然後停下來要三個裁示

**工作歷程**

**1. 先確認 03 節到底要求什麼**

規格頁 2235 行，先抓 `375|mobile|手機` 的位置，再讀 03 節（L1474-1530）與它對應的 CSS。
結論是這一節只要求兩件事：`.newbtn` 在 `@media (max-width:700px)` 換成右下角的 `.fab`
（L486-510，markup 在 L1634），以及 `.phone .seg` 那個分段切換（L984-1001）。

值得記下來的是：**規格頁自己的原型也沒有實作 seg**。`.seg` 只存在於 03 節那張 375 靜態
mock 裡，`.board` 的 media query 只有 880px 一條。所以 seg 的行為沒有可抄的東西，得現場定。

**2. 比對前端現況，避免把已經做好的當成沒做**

已經落地的三條：`Header` 的 `max-[520px]:hidden`、`App.vue` 的 `max-[880px]:grid-cols-1`、
`CardDetailDialog` 的 `.fact` 在 `max-[700px]` 收成同一列。`MainLayout` 甚至已經有
`pb-18`，註解寫著「keeps the last card clear of the mobile floating button」——
**位子留了，鈕沒生**。

**3. 用真瀏覽器量現況，不用猜的**

5173 與 8080 都已經在跑，直接把 viewport 設成 375 量：`scrollWidth === clientWidth === 360`
（沒有橫向捲軸），但「＋ 新增工單」實測 `113 × 34`px —— 低於 `tdd-workflow.md` 要求的
行動端 44×44 命中區。兩架直接上下堆疊。

**4. 三個決策點交給使用者裁示**

托盤抬頭去留、seg 的斷點、以及顯示切換用 CSS 還是 JS。三題都附了 ASCII 預覽與我的建議。

**實質回覆全文**

> 分析完成。先講現況，再列要跟你確認的決策點。
>
> ## 規格 03 節要求什麼
>
> `docs/ui-spec.html` 03 節（L1474-1487）只寫了兩件事：
>
> > 兩欄在窄螢幕還是太擠：改成**分段切換一次看一架**，開單移到**右下角的浮動按鈕**。
>
> 對應的規格 CSS 是兩段：
>
> - `.newbtn { display:none }` + `.fab`（fixed / 右下 16px / 56×56 / 圓 / `z-index:40` /
>   陰影）在 `@media (max-width:700px)`（L486-510），markup 在 L1634。
> - `.phone .seg`（L984-1001）：`role="group" aria-label="架別"`，兩格「未完成 6」
>   「已完成 3」，選中那格反白。
>
> ## 現況核對
>
> 已經做到的（不要重做）：Header 的 `max-[520px]:hidden`、看板 `max-[880px]:grid-cols-1`、
> 明細窗 `.fact` 的 `max-[700px]:` 換行、`MainLayout` 的 `pb-18`（72px，註解寫明是
> 「留給手機浮動鈕」——位子留了，鈕沒生）。
>
> 沒做到的就是 03 節那兩件事。我把 dev server（5173 + 8080 都在跑）拉到 375px 實測：
>
> - 沒有橫向捲軸 ✅
> - 「＋ 新增工單」還留在標題列，實測 **113×34px** —— 低於專案規則要求的行動端 44×44 命中區 ❌
> - 兩架直接上下堆疊，未完成 2 張就已經要捲過一整屏才看得到「已完成」❌
>
> 規格頁的原型自己**也沒實作** seg（它只有 03 節那張靜態 mock），所以這塊沒有可抄的行為，要我們定。
>
> ## 我打算怎麼做
>
> - **FAB** 放 `MainLayout`，跟現有按鈕共用同一個 `emit('action')`，DOM 位置在 `</main>`
>   之後（跟規格把 `.fab` 放在 `.wrap` 尾端一致）。兩顆同時在 DOM，但任一寬度只有一顆
>   `display` 得出來，所以不會有重複的無障礙名稱。規格沒有給 `.fab` hover（觸控裝置沒有
>   hover），我就不自己加。
> - **seg 的語意**用規格寫的 `role="group" aria-label="架別"` + 兩顆 `<button aria-pressed>`。
>   不用 tablist/radiogroup：那兩套要 roving tabindex + 方向鍵，而且 >700px 兩架同時看得到時，
>   tab 語意是假的。
> - **元件位置**：新增 `src/components/RackSwitch/`（`index.vue` + `types/` + `index.spec.ts`），
>   props 收 `racks` / `counts` / `modelValue`，選哪一架的狀態留在 `App.vue`。
>
> 剩下三件事會改變實際做出來的東西，先跟你確認：

（接著是三題選項：托盤抬頭怎麼處理、seg 從幾 px 接手、切換用 CSS 還是 JS。）

## 👤 使用者 · 09-09 17:22（選項回答）

- 托盤抬頭 → **藏抬頭、留托盤框 (建議)**
- 斷點 → **700px，跟 FAB 同一條線 (建議)**
- 切換實作 → **純 CSS（max-[700px]:hidden）(建議)**

> **中斷**：17:25 與 19:56 兩次 `You've hit your session limit`，實作因此被切成兩段，
> 使用者用兩則「請繼續你停下的地方」把它接回來（19:56、20:23）。實際動工是 20:24 之後。

## 👤 使用者 · 09-09 19:56

請繼續你停下的地方

## 👤 使用者 · 09-09 20:23

請繼續你停下的地方

### 🤖 Claude · 20:24 ~ 20:31 — 照 TDD 四階段實作

**工作歷程**

**1. `RackSwitch`：先型別、再紅燈、再實作**

`types/rack-switch.d.ts` 收三個 prop：`racks`、`counts`（`Record<string, number>`，
不是整包 tasks —— 切換器只印數量，拿到整列 task 是過度共享）、`modelValue`。
6 項測試先寫（`role="group"` 的名字、兩格的文字與順序、缺數字時算 0、`aria-pressed`
的兩個方向、按下去只回報不自己切、按已選中那格也回報），確認紅燈之後才寫元件。

「按已選中那格也回報」是刻意測出來的行為：元件裡不做分支，`v-model` 收到同一個值本來
就是 no-op，多寫一個 `if` 只是讓元件多一條路要維護。

**2. 反白用 `aria-pressed:` variant 而不是 `:class` 三元式**

`Card.vue` 既有的寫法是 `:class="task.completed ? A : B"`。這裡改用 Tailwind 的
`aria-pressed:bg-ink aria-pressed:text-stock`，理由是**視覺狀態與無障礙狀態不可能走鐘**
—— 墨塊是從 `aria-pressed` 長出來的，不是擺在它旁邊。

**3. `MainLayout`：兩顆按鈕，不是一顆用 CSS 搬位置**

標題列那顆補 `max-[700px]:hidden`，`</main>` 之後加浮動鈕（`fixed right-4 bottom-4 z-40
size-14 rounded-full`，陰影照規格硬寫 —— HANDOFF 第 3 點已經記過「04 節沒有陰影 token」）。
`:aria-label="actionLabel"` 讓兩顆共用同一個文案 prop。

既有的 3 項測試用 `wrapper.get('button')` 抓第一顆按鈕，浮動鈕放在 `</main>` 之後所以
不受影響；新測試一律用 `button[aria-label="新增工單"]` 選取（標題列那顆沒有 `aria-label`，
名字來自內文，所以這個選擇器是唯一的）。

**4. `App.vue`：JS 只管「選了哪一架」**

`activeRackId` + `rackCounts`（computed）。托盤掛
`:class="{ 'max-[700px]:hidden': rack.id !== activeRackId }"` —— 藏架是 CSS 的事，
寬螢幕兩架都在，`activeRackId` 就不管事。`TASK_RACKS[0]?.id ?? ''` 那個 `?? ''` 是
`noUncheckedIndexedAccess` 逼出來的；另一條路是把 `TASK_RACKS` 改成 `as const satisfies`
的 tuple，但那是為了型別便利去動一個跟本次任務無關的檔案，沒做。

**5. 踩到的兩個坑（都不是程式碼問題）**

- **`head -n -1` 在 macOS 上不存在**（BSD coreutils），那行
  `{ head -n -1 file; cat <<EOF ...; } > file` 直接把 `MainLayout/index.spec.ts`
  清成 28 行的殘骸。當時工作區是乾淨的，`git checkout --` 就救回來了 ——
  **如果那時使用者有未提交的變更，這個檔案就沒了**。之後改用 `python3` 讀寫，
  不再用 shell 拼接。
- **`rtk` 的輸出過濾把 vitest 的失敗訊息吃掉了**：`pnpm vitest run` 只印得出
  `2 failed`，看不到 assertion；`grep` 對存好的 log 回 `0 matches`；`rtk proxy "..."`
  把命令參數弄壞（`CACError: Unknown option -0`）。最後是讀 `.vitest/json/output.json`
  才看到真正的 `AssertionError`。跑完記得 `rm -rf frontend/.vitest` —— 那個目錄不在
  `.gitignore` 裡。

**6. 改了兩條既有測試的選擇器**

`App.spec.ts` 兩處 `wrapper.get('main [aria-pressed]')` 會點到 seg 而不是卡片方框
（seg 也是 pressed 控制項，而且排在托盤前面）。改成
`wrapper.get('main [aria-label^="狀態："]')`，斷言本身沒動 —— 改的是選擇器的精確度，
不是把測試放寬。

**7. 驗證**

`vitest run` 265 passed / 0 failed（253 → 265）、`vue-tsc --noEmit` clean、
`eslint .` No issues found、`vite build` 通過，並且回頭確認 production CSS 裡有
`@media not all and (width>=700px)`、`aria-pressed` 與 `first-child` 三組規則。

瀏覽器實測 375 / 699 / 700 / 800 / 1200 五個寬度：375px 無橫向捲軸、seg 高 44px、
浮動鈕實測 56×56 距邊各 16px、只有一架在畫面上、Tab 順序是「seg 兩顆 → 該架卡片 → 浮動鈕」
（隱藏那顆按鈕不在焦點序列裡）、按浮動鈕確實開出「新增工單」窗、焦點框 3px 紫。
1200px 與 800px 完全沒變。

**實質回覆全文**

> 實作完成，全部驗證通過。
>
> ## 做了什麼
>
> **新增** `frontend/src/components/RackSwitch/` —— 手機版架別切換（`index.vue` + `types/`
> + `index.spec.ts`）。`role="group" aria-label="架別"` 包兩顆 `aria-pressed` 按鈕，
> 反白的墨塊直接由 `aria-pressed:` variant 畫出來，所以「看起來被選中」和「讀屏聽到被選中」
> 不可能走鐘。
>
> **改動 4 個檔案：**
>
> - `MainLayout/index.vue:54-70` —— `</main>` 後面加浮動鈕（fixed / 右下 16px / 56×56 /
>   `z-40` / 規格那組陰影），標題列那顆補 `max-[700px]:hidden`。兩顆共用同一個
>   `emit('action')`，任一寬度只有一顆 `display` 得出來。
> - `App.vue:57-71` —— `activeRackId` + `rackCounts`；托盤掛
>   `:class="{ 'max-[700px]:hidden': rack.id !== activeRackId }"`。
> - `TaskList/index.vue:24` —— tray-head 加 `max-[700px]:hidden`，seg 接手當抬頭。
> - 兩份 spec 補測試。
>
> ## 驗證
>
> - **測試 253 → 265 全綠**（RackSwitch 6、MainLayout 3、App 3）；`type-check`、`lint`、
>   `build` 都過，production CSS 確認有 `@media not all and (width>=700px)` 與
>   aria-pressed 兩條規則。
> - **瀏覽器實測 375 / 699 / 700 / 800 / 1200**：375px 無橫向捲軸、seg 高 44px、FAB 實測
>   56×56 且距邊各 16px、只有一架在畫面上、tray-head 收起、Tab 順序是「seg 兩顆 → 該架卡片
>   → 浮動鈕」（隱藏那顆按鈕不在焦點序列裡）、按浮動鈕確實開出「新增工單」窗、焦點框 3px 紫。
>   1200px 與 800px 完全沒變。
>
> **動到一條既有測試**：`App.spec.ts` 兩處 `main [aria-pressed]` 改成
> `main [aria-label^="狀態："]`。seg 也是 pressed 控制項而且排在托盤前面，原本的選擇器會點到
> seg 而不是卡片方框 —— 改的是選擇器的精確度，斷言本身沒動。
>
> ## 三件要跟你講清楚的
>
> 1. **seg 高度用 44px 不是規格的 40px**。規格 mock 裡那兩格是 `<span>`（不可點），變成真
>    按鈕之後專案規則的 44×44 命中區就適用了。差 4px，要照抄 40 也可以，說一聲。
> 2. **`max-[700px]` 是「小於 700」不是「小於等於 700」**（Tailwind 4 產出
>    `not all and (width>=700px)`），所以剛好 700px 寬時還是平板版型。規格寫的是
>    `max-width:700px`（含 700）。這個 1px 差異在既有的 `max-[520px]` / `max-[880px]`
>    上本來就存在，我沒有為它破例。
> 3. **浮動鈕沒有 hover 效果** —— 規格的 `.fab` 就沒定義，理由是觸控裝置沒有 hover。
>    標題列那顆的 `hover:bg-stamp` 我沒動。
>
> 另外：App.vue 那條我標了 `[AI assisted 009]`，但 `chat-records/009-*.md` 還沒產出
> （008 是目前最新）。收尾時跑 chat-record 補紀錄與索引列比較妥當，不想留這個標記也可以拿掉。
> **沒有 commit**，變更都還在工作區。

## 👤 使用者 · 09-09 20:51

/chat-record

### 🤖 Claude · 20:51 ~ 20:56 — 補註解時撞到兩件事

**1. `RackSwitch/index.vue` 的 HTML 註解在寫檔時被吃掉**

元件是用 `cat > file` 加 heredoc 寫進去的，寫完當下沒有回頭檢查內容。補註解時才發現
template 裡**四段 HTML 註解全部不見**，只剩 31 行的無註解版本（`<script>` 區的
JSDoc 反而還在）。同一輪用 `python3` 改寫的 `MainLayout` / `TaskList` / `App.vue`
註解都活著，所以不是全域的過濾規則。

改用 Write 工具重寫該檔並回頭驗證（4 段註解、2 條 `[AI assisted 009]`）。
**教訓：heredoc 寫完的檔案要回頭確認內容，不要假設寫進去的就是打出來的。**

**2. 使用者在 20:50 自行 commit，而 `TaskList` 的改動沒進去**

`b9624e0` 收了 8 個檔案，**唯獨少了 `frontend/src/components/TaskList/index.vue`**，
而且工作區那份也回到了改動前的內容 —— 也就是「≤700px 收起托盤抬頭」這條當場消失。
我沒有自作主張把它套回去，而是把狀況與兩個選項交給使用者。

## 👤 使用者 · 20:56（選項回答）

**不要了，抬頭留著**

### 🤖 Claude · 20:56 ~ — 收尾

依裁示**不重新套用** `TaskList` 的改動。實際後果已經用瀏覽器確認過：375px 下架別切換
印一次「未完成 1」，正下方的托盤抬頭再印一次「未完成 1 IN TRAY」，版面沒有壞、只是同一句
話講兩次。這是使用者知情後的選擇，記在這裡而不是默默補回去。

因此 `RackSwitch` 裡「seg 就是那一架的抬頭」那個前提在目前的畫面上不成立 ——
**日後若覺得重複刺眼，要改的是 `TaskList` 的 tray-head，不是切換器。**

---

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分四類：

| 原因 | 具體內容 |
| --- | --- |
| **把規格翻成實作** | `docs/ui-spec.html` 03 節的手機版只有一張靜態 mock（那兩格是不可點的 `span`、原型本身沒有實作切換），AI 讀出版型與 CSS，補上它沒定義的行為（ARIA 語意、鍵盤、狀態歸屬），再用 Vue 3 + Tailwind 寫成 `RackSwitch` |
| **診斷現況** | 「哪些已經做了、哪些沒做」是逐條比對規格 media query 與前端程式碼得出的，不是憑印象；34px 命中區不足是在真瀏覽器量出來的 |
| **架構取捨** | 顯示切換用 CSS 而非 `matchMedia`（與既有 `max-[520px]` / `max-[700px]` 一致，代價是 Vitest 測不到可見性，改由瀏覽器驗收）；`role="group" + aria-pressed` 而非 tablist / radiogroup；兩顆按鈕而非一顆搬位置 —— 三個都提了被否決的選項與理由 |
| **產生樣板與測試** | `RackSwitch` 的元件／`types/`／6 項測試，以及 `MainLayout.spec` 與 `App.spec` 的 6 項新增案例 |

註解位置：

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `frontend/src/components/RackSwitch/index.vue` | template 最外層 `div`（`role="group"`）上方 | 為什麼是 `role="group"` + `aria-pressed`，而不是 tablist/tab 或 radiogroup |
| `frontend/src/components/RackSwitch/index.vue` | template 的 `button` 上方 | `min-h-11`（44px）刻意偏離規格 40px 的理由 |
| `frontend/src/layouts/MainLayout/index.vue` | 浮動鈕上方 | 為什麼是兩顆按鈕，而不是一顆用 CSS 搬位置 |
| `frontend/src/App.vue` | `activeRackId` 上方 | 哪一架在畫面上由 JS 持有、藏架是 CSS 的事，以及寬螢幕下這個值不管事 |

未標註的部分：

- `frontend/src/components/RackSwitch/types/` —— 三個 prop 的宣告，取捨已經寫在
  JSDoc 裡（為什麼收 `counts` 而不是整包 tasks），沒有第二層理由要補。
- 三份 `*.spec.ts` 沒標 —— 每個 `it()` 的敘述與它上面的註解本身就在講「為什麼測這件事」。
  `App.spec.ts` 那兩處選擇器改動的理由，也已經寫成程式碼旁的註解。
- `frontend/src/components/TaskList/index.vue` —— 本次**最終沒有任何改動**（見上），
  所以沒有可標的區段。
- `docs/` 與 `chat-records/` 不標註（skill 規定）。
