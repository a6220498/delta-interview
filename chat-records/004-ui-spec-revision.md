# 對話紀錄 004 — 規格頁改版：契約欄位進 UI、表單標示重整、色票落地

> 範圍：把 003 定案的契約欄位（`category` / `description` / `sequence`）畫進 `docs/ui-spec.html`
> 的原型，重整新增／編輯彈窗的標示規則，並把規格頁 04 節的色票搬進 `frontend/src/style.css`。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                              |
| -------- | ------------------------------------------------------------ |
| Session  | `f4b9fd4c-4039-4287-a52c-9914002c2548`                       |
| 專案     | `/Users/allen/Desktop/delta-interview`                       |
| 期間     | 09-08 01:32 ~ 02:25                                          |
| 匯出時間 | 2026-09-08 02:25                                             |
| 內容     | 使用者 4 則（另含 1 次選項回答）、Claude 實質回覆 5 則、工具往返 108 次 |
| 產出     | `docs/ui-spec.html` 改版至 REV. C 修訂 11；`style.css` 換成 04 節色票；`index.html` 補字體 |

---

## 👤 使用者 · 09-08 01:32

讀取一下, docs裡面的內容, 我要跟你討論畫面上的修改

### 🤖 Claude · 09-08 01:32 ~ 01:39 — 讀規格並回報三個落差

讀了 `docs/HANDOFF.md`、`docs/ui-spec.html`（1506 行，含 CSS 與原型 JS）、`api/openapi.yaml`
與 `frontend/` 現況，回報規格頁五節的狀態與硬性設計決策，並指出三個落差：

1. **01/02 節原型跟契約已經對不上** —— 原型寫死 `WO-0012` 前綴、沒有 `category` 下拉、
   彈窗沒有 `description` 的 `<textarea>`。
2. **`style.css` 的 `@theme` 是通用藍白**（`#f6f7f9` / `#2f6df6`），跟 04 節那套紙本工單
   token 完全不同，而且還帶了 dark mode —— 但規格頁明寫「單一主題（日班）」。
3. **`App.vue` 目前是空殼**，畫面一行都還沒寫。

---

## 👤 使用者 · 09-08 01:39

1. 改規格上的畫面, 我的新增與編輯工單 1. 都要有 description欄位 可以輸入 2. 都要有類別的下拉選項

2. 如果有多dark-mode 把它刪掉, 原則上只有一種模式

3. APP.vue 這邊的設計架構 我尚未開始, 等UI/UX設計好後我才開始實現。

### 🤖 Claude · 09-08 01:39 — 動工前的兩個分岔

加類別下拉會直接牽動兩件事，用選項卡請使用者裁示，而不是自己決定：

**Q1 · 卡片存根上的編號要不要一起改成 `bug-0007` / `feat-0003`？**
（HANDOFF 已裁示「原型裡的 `WO-` 前綴與 `pad()` 要照這條改」，只是還沒執行。
不改的話，彈窗裡選了 bug 卻生出 `WO-0020`，原型會自相矛盾。）

**Q2 · 類別要不要在卡片正面看得出來？**
（契約的 `category` 描述寫它 drives「the card's colour」，但 02 節九個狀態只有一套配色。
選項：只靠編號前綴分辨／存根加一個類別標記／先不處理。）

## 👤 使用者 · 09-08 01:40（選項回答）

- Q1 → **一起改成 category-sequence**
- Q2 → **存根加一個類別標記**

### 🤖 Claude · 09-08 01:40 ~ 01:59 — 工作歷程

**先做範圍最小的 dark mode**：全專案只有 `frontend/src/style.css:26` 一段
`@media (prefers-color-scheme: dark)`，刪掉並補上 `color-scheme: light` ——
token 覆蓋管不到瀏覽器自己的日期選擇器、下拉、捲軸與 `::backdrop`，而規格頁大量
使用原生 `<dialog>` 與 `<input type="date">`。規格頁本身早已是單一主題，不必動。

**規格頁改版**，分六次 patch（每次都用 `assert count == 1` 鎖住替換目標，避免誤傷）：

- **CSS · 存根**：改成直向排列，狀態色收斂成 `--paper`（紙色）與 `color`（墨色）兩個變數，
  底下的編號與類別記號都吃 `currentColor`，不必為每個狀態各寫一條規則。
- **CSS · 類別記號**：15×15，實心 `bug` / 空心 `feat`。**刻意不開第三條色軸** —— 卡片的
  顏色已經被逾期（紅）與完成（紫）用掉。記號對讀屏是冗餘的（底下的單號本來就印著
  `bug`／`feat`），所以整塊 `aria-hidden`。
- **CSS · 表單欄位**：`input` / `select` / `textarea` 共用同一條「可以寫字的線」。下拉自補箭頭
  （`appearance: none` 會連原生箭頭一起拿掉）。說明欄用 `repeating-linear-gradient` 畫橫線、
  行高對齊格線，並加 `background-attachment: local` 讓格線跟著內容捲動 —— 固定住的話
  捲到第二頁字會跟線錯開。
- **HTML · 彈窗**：補上 `category` 下拉與 `description` 的 `<textarea>`。順帶修正標題的
  `maxlength`：原本寫 120，與契約的 200 對不上。
- **HTML · 02/03 節**：九張狀態圖與手機版型的單號全面換掉，各卡加上類別記號；
  載入中那張用虛線空框佔位（類別還沒回來，但位置先站住）。
- **JS**：資料模型補 `category` / `sequence` / `description`，實作兩個獨立計數器與
  「改類別重新發號」，並讓類別欄位在真的改動時即時跳出換號警告。

**驗證**：抽出原型 JS 過 `node --check`；起 `python3 -m http.server` 用瀏覽器實跑，
逐一操作新增、編輯、改類別發號、拖拉、選單與 375px 版型。

過程中發現一處自己改出來的問題：02 節縮圖的 `.lab` 有 `text-transform: uppercase`，
把單號印成 `BUG-0012`，但契約的 enum 是小寫。原本 `WO-0012` 已經是大寫所以看不出來。
加 `text-transform: none` 修掉。

### 🤖 Claude · 09-08 01:59 — 完成回報

彈窗從兩欄變四欄；編號改成 `category`-`sequence`，兩個計數器獨立、改類別重新發號，
在原型裡是真的會跑的（實測 `feat-0004` 改成 bug → 拿到 `bug-0013`）。

類別記號的決定**沒有照契約那句 category drives「the card's colour」做**：卡片的顏色已經
被逾期跟完成佔滿，第三條色軸會搶注意力，也會踩到 04 節自己訂的「狀態不只用顏色」。
改用形狀差異，這條寫進 HANDOFF。

驗證：`pnpm build` ✓ ／ `pnpm test` 9 passed ✓ ／ `eslint .` exit 0 ✓
（第一次 lint 因記憶體被砍掉，加大 heap 後乾淨通過）。

兩件請使用者決定：(1) `style.css` 的 `@theme` 跟 04 節是兩套色票，實作看板前得先擇一；
(2) `docs/` 整個在 `.gitignore` 裡，`HANDOFF.md` 與 `ui-spec.html` 都沒進版控，但
HANDOFF 最後那段起手提示詞正是叫人去讀它們。

另外「在看板上讀 `description`」的入口還沒設計 —— 使用者這次要的是輸入，所以沒自己補。

---

## 👤 使用者 · 09-08 02:07

1. 依據現在規格頁的04為主

2. 不理會

3. 在看板上不需要讀 description

4. 新增工單跟編輯工單的欄位必填刪掉, 把它移動到標題的右邊給一個*符號 且為紅色, 但是必填欄位刪掉時， 必須留空位，未來驗證時出錯要出現提示用。選填那些 就不需要顯示了, 例如: 選填。卡片正面不放它，看板要維持能一眼掃完。

5. 新增編輯的彈窗 的每個欄位標題 看看能不能改的明顯一點。

6. 新增編輯的彈窗的placeholder 太像真實輸入的文字了, 稍微改一下。

### 🤖 Claude · 09-08 02:07 ~ 02:25 — 工作歷程

**色票落地**：先確認沒有元件在用舊 token（`App.vue` 是空的、`_core.scss` 只有一個 mixin），
可以整組換掉。搬進 04 節那套之後 build 一次檢查產出，發現**只有 `--color-desk` 與
`--font-display` 進了 CSS** —— Tailwind 4 會把沒被任何 utility 用到的 theme 變數搖掉。
規格是用 raw `var(--color-…)` 寫的，元件在 `<style>` 裡直接取用會解析成空值（靜默失敗，
不是編譯錯誤），所以改成 `@theme static`，16 個色票全數輸出，代價 +330 bytes。

同時發現 `--font-*` 指向的四個字型從來沒被載入過，補 Google Fonts 連結到
`frontend/index.html`。另外 04 節本身漏列了原型一直在用的 `--tray-edge` 與 `--rule-2`，
既然要當唯一來源就補進去。

**表單標示重整**：欄位標題 10.5px 淡灰 → 12.5px / 700 / `--ink-2`；「必填」字樣換成標題
右邊的紅星（語意由 `<input required>` 承擔，星號 `aria-hidden`）；選填的說明句全部拿掉；
每欄下方留一列 `min-height: 17px` 的訊息位；placeholder 改成斜體、14px、再淡一階。

**驗證**：瀏覽器逐一比對「訊息出現前後彈窗高度」，確認欄位不位移；`pnpm build` /
`pnpm test` / `eslint` 全過。

### 🤖 Claude · 09-08 02:25 — 完成回報

六項都做完。兩處超出字面要求但主動處理並說明的：

- **選填欄位也留了空位**。使用者只提到必填，但 `description` 有 2000 字上限、`dueDate`
  也可能格式錯，那些錯誤同樣需要落點；四欄一致才不會有的跳有的不跳。
- **類別的「重新發號」警告縮短成一行**（`重新發號：feat-0004 → bug-0013`）。
  原本那句會折兩行，撐破預留的一行高度。

留白那列接上了實際驗證：空標題送出顯示「標題不能空白。」、底線同時轉紅、開始打字就收掉
—— 預留訊息位的目的就是承接驗證訊息，讓規格頁直接演示而不是用文字描述。

**還沒解決**：04 節沒有陰影 token，原型卻用了三種不同的陰影（卡片、popover、彈窗／浮動鈕）。
沒自作主張加，記進 HANDOFF。

---

## 👤 使用者 · 09-08 02:23

現在請你把這段session對話 存入到chat-records裡面 依據以下規則去實現

## AI 使用指引
本任務允許使用 AI 工具，例如 GitHub Copilot、ChatGPT、Claude 或其他類似工具。

如果你使用 AI，請：
1. 在相關程式碼區段加入註解，例如 `// [AI assisted {chat-number}]`
2. 簡要說明你使用 AI 的原因，例如查詢 API 用法、產生樣板程式碼，或解決特定問題，並將你的對話紀錄存放在以該對話編號命名的資料夾中。

範例：
```js
// [AI assisted 001] 使用 AI 協助產生任務清單元件
const todo = (list) => { ... };
```
```
\chat-records\001.chat
```

### 🤖 Claude · 09-08 02:25 — 補註解與對話紀錄

依 `chat-records/README.md` 既有慣例定編號為 **004**，本次改動的程式碼區段加上 8 處
`[AI assisted 004]`（3 個檔案），並更新索引表。

---

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分四類：

| 原因 | 具體內容 |
| --- | --- |
| **指出需求的連帶影響** | 「加類別下拉」會連帶決定卡片編號怎麼印、類別要不要在卡片正面現身 —— 這兩個分岔由 AI 在動工前提出，整理成選項連同 trade-off 交給使用者裁示，而不是自行決定 |
| **解決特定問題** | Tailwind 4 的 `@theme` 會 tree-shake 未被使用的變數，導致 16 個色票只輸出 2 個；由 AI 在檢查 build 產出時發現，改用 `@theme static` 解決 |
| **設計視覺與無障礙的取捨** | 類別記號改用形狀（實心／空心）而非顏色，避開與逾期紅、完成紫的衝突；星號 `aria-hidden` 搭配 `required`；訊息列 `aria-live="polite"` 且高度預留以免版面跳動 |
| **產生樣板與同步改寫** | 表單欄位的 CSS 與 HTML、原型 JS 的發號邏輯與驗證、02／03 節九張狀態圖與手機版型的同步更新，以及 `HANDOFF.md` 的決策紀錄 |

### AI 主動發現、非使用者指出的問題

| 問題 | 處置 |
| --- | --- |
| 彈窗標題 `maxlength="120"`，與契約的 200 對不上 | 改成 200 |
| 02 節縮圖 `.lab` 的 `text-transform: uppercase` 把單號印成 `BUG-0012`，但契約 enum 是小寫 | 加 `text-transform: none` |
| 04 節漏列原型實際在用的 `--tray-edge` 與 `--rule-2` | 補進 04 節與 `style.css` |
| `--font-*` 指向的四個字型從未被載入 | `index.html` 補 Google Fonts 連結 |
| 04 節沒有陰影 token，但原型用了三種陰影 | **未處理**，記入 HANDOFF 待裁示 |

## 註解位置

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `docs/ui-spec.html` | `.cat` 前 | 類別記號用形狀而非顏色，刻意沒照契約那句「drives the card's colour」 |
| `docs/ui-spec.html` | `.field .hint` 前 | 選填欄位也一起留訊息位的理由 |
| `docs/ui-spec.html` | `::placeholder` 前 | 用字形／字級／明度三個維度拉開距離，而不只改文案 |
| `docs/ui-spec.html` | `<form data-sheetform>` 前 | 補 `category` 與 `description`、改必填標示、修正 `maxlength` |
| `docs/ui-spec.html` | `numOf()` 前 | 把 003 定案的編號規則落到原型上的必要性 |
| `docs/ui-spec.html` | `setTitleError()` 前 | 把空標題驗證接起來，讓預留的訊息位有東西演示 |
| `frontend/src/style.css` | `@theme static` 上方註解 | `static` 這個關鍵字是檢查 build 產出時發現要加的 |
| `frontend/index.html` | 字體 `<link>` 前 | `--font-*` 指向的字型從未被載入 |

## 本次改動的檔案

| 檔案 | 進版控 | 改動 |
| --- | --- | --- |
| `docs/ui-spec.html` | ✗（`docs/` 在 `.gitignore`） | REV. B 修訂 9 → REV. C 修訂 11 |
| `docs/HANDOFF.md` | ✗（同上） | 新增 6 條設計決策；3 個待辦結案 |
| `frontend/src/style.css` | ✓ | 換成 04 節色票、移除 dark mode、`@theme static` |
| `frontend/index.html` | ✓ | 補四個字體的 Google Fonts 連結 |

> `docs/` 在 `.gitignore:27`，所以規格頁與交接文件的改動只在磁碟上，不會進 commit。
> 這件事在 003 就記過，本次使用者明確裁示**不處理**。
