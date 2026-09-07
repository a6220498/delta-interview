# 對話紀錄索引

本專案全程由 AI（Claude）協助開發。程式碼中的 `// [AI assisted NNN]` 註解，`NNN` 對應
下表的對話編號；每一則紀錄都保留使用者訊息全文與該次改動的決策理由。

| 編號 | 紀錄 | 階段 | 期間 | 產出 |
| --- | --- | --- | --- | --- |
| **001** | [001-screen-design.md](./001-screen-design.md) | 設計 — UIUX | 09-06 02:11 ~ 23:58 | `docs/ui-spec.html`（五節規格頁） |
| **002** | [002-project-init.md](./002-project-init.md) | 實現 — 專案骨架 | 09-06 23:38 ~ 09-07 00:53 | monorepo、`api/openapi.yaml`、前後端骨架 |
| **003** | [003-backend-contract-revision.md](./003-backend-contract-revision.md) | 實現 — 契約修訂 | 09-08 00:54 ~ 01:16 | `category` / `sequence` / `dueDate`；後端測試 8 → 15 |

編號依**對話發生時間**排序，不是依檔案建立時間 —— 001 的 UIUX 設計早於 002 的專案初始化。

001 與 002 原本用的是無編號的描述性檔名（`screen-design.md` / `project-init.md`），
在 003 這次對話中以 `git mv` 補上編號前綴，git 歷史沿用同一條線。
兩份檔案**內文未改**：裡面提到舊檔名的地方屬於當時的對話內容，改掉等於竄改紀錄。

## 為什麼要有這份索引

題目要求「在相關程式碼區段加入 `// [AI assisted {chat-number}]` 註解，並將對話紀錄存放在
以該對話編號命名的位置」。程式碼裡的編號要能查得到對應的對話，才有意義；這份表就是那個
對照關係。
