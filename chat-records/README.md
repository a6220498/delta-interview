# 對話紀錄索引

本專案全程由 AI（Claude）協助開發。程式碼中的 `// [AI assisted NNN]` 註解，`NNN` 對應
下表的對話編號；每一則紀錄都保留使用者訊息全文與該次改動的決策理由。

| 編號 | 紀錄 | 階段 | 期間 | 產出 |
| --- | --- | --- | --- | --- |
| **001** | [001-screen-design.md](./001-screen-design.md) | 設計 — UIUX | 09-06 02:11 ~ 23:58 | `docs/ui-spec.html`（五節規格頁） |
| **002** | [002-project-init.md](./002-project-init.md) | 實現 — 專案骨架 | 09-06 23:38 ~ 09-07 00:53 | monorepo、`api/openapi.yaml`、前後端骨架 |
| **003** | [003-backend-contract-revision.md](./003-backend-contract-revision.md) | 實現 — 契約修訂 | 09-08 00:54 ~ 01:16 | `category` / `sequence` / `dueDate`；後端測試 8 → 15 |
| **004** | [004-ui-spec-revision.md](./004-ui-spec-revision.md) | 設計 — 規格頁改版 | 09-08 01:32 ~ 02:25 | 契約欄位進 UI、表單標示重整、04 節色票落地 |
| **005** | [005-category-numeric-code.md](./005-category-numeric-code.md) | 實現 — 契約修訂 | 09-08 02:31 ~ 02:48 | `category` 改為數字碼（`0` = feature、`1` = bug） |
| **006** | [006-board-ui-build.md](./006-board-ui-build.md) | 實現 — 前端 UI | 09-08 16:06 ~ 09-09 04:19 | 看板六個元件（版型／抬頭／托盤與工單卡／工單彈窗／刪除確認／row menu）；前端測試 11 → 143 |
| **008** | [008-card-detail-dialog.md](./008-card-detail-dialog.md) | 實現 — 前端 UI | 09-09 16:27 ~ 17:12 | 工單明細窗與「點卡片開明細」入口；前端測試 214 → 253 |
| **009** | [009-mobile-board-layout.md](./009-mobile-board-layout.md) | 實現 — 前端 UI | 09-09 17:17 ~ 20:55 | 375px 版型：架別切換（`RackSwitch`）與右下角浮動新增鈕；前端測試 253 → 265 |
| **011** | [011-write-button-throttle.md](./011-write-button-throttle.md) | 實現 — 前端 UI | 09-09 21:42 ~ 22:54 | 三顆寫入按鈕加節流（`utils/throttle.ts`、`utils/` barrel、`WRITE_THROTTLE_MS`）；前端測試 266 → 276 |

編號依**對話發生時間**排序，不是依檔案建立時間 —— 001 的 UIUX 設計早於 002 的專案初始化。
004 回頭改設計（規格頁），排在 003 之後是因為它接續 003 定案的契約欄位 ——
階段標籤反映的是**做了什麼**，不是專案走到哪一步。

001 與 002 原本用的是無編號的描述性檔名（`screen-design.md` / `project-init.md`），
在 003 這次對話中以 `git mv` 補上編號前綴，git 歷史沿用同一條線。
兩份檔案**內文未改**：裡面提到舊檔名的地方屬於當時的對話內容，改掉等於竄改紀錄。

**007 是一個缺口。** `docs/ui-spec.html` 裡有 5 條 `[AI assisted 007]`，來自 09-09 15:38 ~
16:23 那場把「工單明細」畫進規格頁的對話（session `deebd4e4`），但那次沒有產出紀錄檔，
所以這張表沒有 007 這一列。008 沒有沿用 007，是因為沿用會讓規格頁裡那 5 條註解指到一份
講別的事情的紀錄 —— 編號的用途就是讓程式碼查得到對應的對話，撞號等於毀掉它。
007 的紀錄可以事後補上，transcript 還在。

**010 是第二個缺口，成因和 007 一樣。** `frontend/src/` 裡有 5 條 `[AI assisted 010]`，
分佈在 `App.vue`、`layouts/MainLayout/index.vue`、`components/TaskList/index.vue`（2 條）
與 `components/TaskList/RowMenu.vue`，來自 commit `573e913`（RowMenu 改用 anchor 位移關閉、
托盤高度修正）那場對話，同樣沒有留下紀錄檔。011 沒有沿用 010，理由與 008 不沿用 007 相同。

這兩個缺口也說明**只看這張表的最大編號 +1 是不夠的**：定新編號之前要先
`grep -rho "AI assisted [0-9]\{3\}" frontend/src docs`，看程式碼裡實際已經用到哪個號碼。
011 這次就是先寫成 010、收尾檢查時才發現撞號改回來的。

## 為什麼要有這份索引

題目要求「在相關程式碼區段加入 `// [AI assisted {chat-number}]` 註解，並將對話紀錄存放在
以該對話編號命名的位置」。程式碼裡的編號要能查得到對應的對話，才有意義；這份表就是那個
對照關係。
