# 對話紀錄 005 — `category` 從字串 enum 改成數字碼（0 = feature、1 = bug）

> 範圍：契約的第二次修訂 —— `TaskCategory` 由 `enum: [bug, feat]` 改成 `enum: [0, 1]`，
> 並同步後端測試、前端測試替身與文檔。後端 Java 主程式碼零改動。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> 連續工具呼叫之間的過場語句已整併為「工作歷程」區塊。

|          |                                                          |
| -------- | -------------------------------------------------------- |
| Session  | `852f64e0-d44a-4a8b-a054-466236c40277`                   |
| 專案     | `/Users/allen/Desktop/delta-interview`                   |
| 期間     | 09-08 02:31 ~ 02:48                                      |
| 匯出時間 | 2026-09-08 02:48                                         |
| 內容     | 使用者 2 則、Claude 實質回覆 3 則、工具往返約 55 次      |
| 產出     | `TaskCategory` 改為數字 enum；後端測試 15 passed（新增一項舊字串寫法要被擋掉）；README 新增一節、HANDOFF 補一節 |

---

## 👤 使用者 · 09-08 02:31

後端契約修改一下, category欄位不應該是字串而是數字
0 = feature
1 = bug

### 🤖 Claude · 09-08 02:31 ~ 02:39 — 工作歷程

**0. 先看清楚 `bug` / `feat` 這兩個字串散在哪裡**

讀 `api/openapi.yaml`、後端 `TaskRepository` / `TaskController` / `TaskControllerTest`、
前端 `types/task.ts` 與 `tasks.spec.ts`、`README.md`、`docs/HANDOFF.md`、`docs/ui-spec.html`、
以及 003 這次改動的紀錄。工作區乾淨，沒有使用者未提交的變更。

**1. 契約（`api/openapi.yaml`）**

```yaml
TaskCategory:
  type: integer
  format: int32
  enum: [0, 1]
  x-enum-varnames: [FEATURE, BUG]
```

`x-enum-varnames` 是這次的關鍵。沒有它，openapi-generator 對數字 enum 產出的常數名會是
`NUMBER_0` / `NUMBER_1` —— 那等於把「0 是什麼意思」這件事從契約裡刪掉，後端每個用到的地方
都得自己加註解。加上之後產生出來的是：

```java
public enum TaskCategory {
  FEATURE(0),
  BUG(1);
  ...
  @JsonValue public Integer getValue() { ... }
  @JsonCreator public static TaskCategory fromValue(Integer value) { ... }
}
```

Java 端因此一個裸數字都不會出現；前端拿到的是 `0 | 1`，名字與顯示前綴在畫面邊界查一次表。
碼、類別名與顯示前綴的對照表**只寫在 `TaskCategory` 的 description 一處**，避免 0 / 1
散落成沒有註解的魔術數字。

仍然是**封閉** enum 而不是任意整數：範圍外的碼（例如 `2`）在邊界就是 400，不會變成一張
畫不出來的卡片 —— 這條理由 003 就寫過，換成數字碼之後一字不改地成立。

順手改了兩處描述文字：`sequence` 的說明從「`bug` 與 `feat` 各自計數」改成「兩個類別各自
計數」（類別名已經不在契約的值裡了），以及 `category` 的 “drives the card's **colour**”
改成 “the card's **shape**” —— HANDOFF 本來就記著「畫面刻意沒照契約用顏色，改用形狀」
這個矛盾，這次一併對齊。

**2. 後端主程式碼：零改動**

`TaskRepository` 的發號機制是 `EnumMap<TaskCategory, AtomicInteger>`、`update()` 用
`category == task.getCategory()` 判斷要不要重新發號 —— 產生出來的仍然是 Java enum，
只是底層值從 `String` 換成 `Integer`，這些程式碼**完全不受影響**。`TaskController` 同理。
契約優先的產生流程在這裡兌現了它的承諾：改的是契約，不是實作。

**3. 後端測試**

payload 與斷言換成數字碼（`"category":0` / `is(0)`）。`rejectsUnknownCategory` 從一個
`perform` 變成兩個，多鎖一件事：**舊契約的字串寫法 `{"category":"bug"}` 也要 400**。
沒跟上這次改動的客戶端因此會在邊界收到 400，而不是被猜出一個值、把壞資料寫進來。

**4. 前端**

`types/task.ts` 不用動（`TaskCategory` 是從契約重新匯出的）。`tasks.spec.ts` 的測試替身
改成 `category: 0` —— 這幾處正是 003 改用 `satisfies Task` 想接住的情形：契約一變，
型別檢查直接指到替身，而不是讓假資料默默失真。

**5. 文檔**

`README.md` 新增〈`category`：數字碼而不是名字〉一節（值 / 類別 / 顯示前綴 / Java / TypeScript
五欄對照表），編號公式從 `${category}-...` 改成 `${PREFIX[category]}-...`。
`docs/HANDOFF.md` 在「硬性設計決策」末尾補一節記錄這次修訂，並註明規格頁沒有跟著改的理由。

**6. 驗證**

`mvn clean verify` BUILD SUCCESS（15 tests）、`pnpm test` 9 passed、`vue-tsc --noEmit` 乾淨、
`vite build` 成功、ESLint 0 issues。

另外起一台實機（port 8099，避開使用者自己那台 8080）打過一輪：`category` 在線上就是 JSON
數字、`0` 與 `1` 兩個計數器各自從 1 開始、把 bug 改成 `0` 會重新發號而 `id` 一字未改、
`2` / `"bug"` / 缺欄位全部 400。驗完就把測試用的後端關掉。

一個假警報：`pnpm lint` 印出 `Linter process terminated abnormally (possibly out of memory)`。
這是 `rtk` 那層輸出過濾器報的，不是 ESLint —— 用 `rtk proxy "pnpm lint"` 跑，exit 0、
沒有任何 issue。（003 那次把同一個現象歸給了 heap 不足，這次確認不是。）

### 🤖 Claude · 09-08 02:39 — 完成回報與三個待裁示

回報改動與驗證結果，並提出三件超出或貼著範圍邊界、不該自己決定的事：

1. **`docs/ui-spec.html` 這次沒動。** 原型內部仍用字串類別名（mock data、`data-cat` CSS
   屬性選擇器、換號提示都吃字串），畫面輸出完全不受影響，但表單裡 `<option value="bug">`
   的 value 與線上格式不一致。
2. **顯示前綴維持 `feat-0003` / `bug-0007`**，沒有因為使用者寫「0 = feature」就改成
   `feature-0003`。
3. **契約描述把 “the card's colour” 改成 “the card's shape”** —— 超出這次要求的範圍，
   要還原也可以。

## 👤 使用者 · 09-08 02:43

1. 那只是參考畫面, 如果不影響顯示就不需要動

2. 依舊維持feat-0003/bug-0007這樣子

3. 這改法沒問題

一樣在chat-records補個 005吧  跟之前一樣

### 🤖 Claude · 09-08 02:43 ~ 02:48 — 定案並補紀錄

三點全部維持現狀：規格頁不動（它是參考畫面，內部表示法不影響顯示）、顯示前綴維持
`feat-` / `bug-`、契約的 shape 改法留著。撰寫本檔並在
[`chat-records/README.md`](./README.md) 補上 005 的索引列。

---

## 這次修訂的破壞性

`category` 現在是數字碼，舊 payload `{"category":"feat"}` 一律 400。003 那次的破壞性是
「`category` 變必填」，這次是「同一個欄位換了型別」—— 兩次都靠契約產生的型別讓兩端無法
悄悄漂移：後端改契約後直接編譯不過，前端 `satisfies Task` 直接型別檢查失敗。

`docs/ui-spec.html` 是**唯一**留著字串類別名的地方，且刻意如此：它是設計參考畫面，
不接 API。真正接 API 的前端要照契約那張表在畫面邊界換算。

## AI 協助的範圍與原因

本次改動全部經由 AI（Claude Opus 5）協助完成。使用 AI 的原因分三類：

| 原因 | 具體內容 |
| --- | --- |
| **查詢產生器的用法** | 數字 enum 在 openapi-generator 下預設會產出 `NUMBER_0` / `NUMBER_1`；`x-enum-varnames` 這個 vendor extension 是由 AI 找出並實測驗證的，是這次改動可讀性的關鍵 |
| **判斷改動的實際邊界** | 指出後端主程式碼（`EnumMap` 發號機制、類別比對）完全不受影響，以及 `docs/ui-spec.html` 動與不動的取捨，交給使用者裁示而不是自己擴大範圍 |
| **補上遷移防線與驗證** | `rejectsUnknownCategory` 增補「舊字串寫法要被擋掉」這條斷言；實機打一輪確認線上格式；辨識出 `pnpm lint` 的 OOM 訊息其實來自 rtk 的輸出過濾器 |

註解位置：

| 檔案 | 位置 | 標註的內容 |
| --- | --- | --- |
| `api/openapi.yaml` | `TaskCategory` schema 上方 | 改成數字碼的理由，以及把對照表收在 description 一處的用意 |
| `backend/.../TaskControllerTest.java` | `rejectsUnknownCategory` | 這個測試同時鎖住「範圍外的碼」與「舊字串寫法」兩件事 |
| `frontend/src/api/tasks.spec.ts` | `sampleTask` | `satisfies Task` 這次接住了什麼 |

未標註的部分：`README.md`、`docs/HANDOFF.md` 是文檔而非程式碼，改寫內容與理由記錄在本檔
〈工作歷程〉第 5 點。
