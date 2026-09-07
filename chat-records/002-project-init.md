# 對話紀錄 — 建立 Monorepo 專案骨架（Delta 面試作業）

> 範圍：專案初始化階段 —— 自「起一個 monorepo 專案」起，至第一次 commit `f45910b` 為止。
> 設計階段（UIUX）的對話另見 [001-screen-design.md](./001-screen-design.md)。
>
> **關於完整性**：本檔保留使用者訊息全文與 Claude 的實質回覆全文。
> Claude 在連續工具呼叫之間的過場語句（如「Now the backend test:」這類單句）
> 已整併為「工作歷程」區塊，避免淹沒實際的決策內容。

|          |                                                        |
| -------- | ------------------------------------------------------ |
| Session  | `43b03306-3956-4898-910d-b9224b62cf11`                 |
| 專案     | `/Users/allen/Desktop/delta-interview`                 |
| 期間     | 09-06 23:38 ~ 09-07 00:53                              |
| 匯出時間 | 2026-09-07 00:53                                       |
| 內容     | 使用者 5 則、Claude 5 則、工具往返約 94 次             |
| 產出     | commit `f45910b`（42 檔案、6579 行）                   |

---

## 👤 使用者 · 09-06 23:38

請先起一個monorepo專案
前端使用vue3+typescript+vite+tailwindcss+scss, 並依據.claude/frontend 格式建立資料夾
後端使用Spring Boot 3, 使用 OpenAPI 規格定義產生 API

### 🤖 Claude · 09-06 23:38

讀取 `.claude/frontend/rules/` 全部 7 份規則（role、tech-stack、coding-style、tdd-workflow、workflow-principles、architecture、git-conventions），並盤點本機工具鏈。

盤點結果：Java 21 + Maven 3.9.16、Node 26、npm 11 / pnpm 10（無 Gradle）。因此後端採 Maven。

三個會實質改變產出的決策，先問過再動工。

### 🤖 Claude · 09-06 23:39 — 詢問技術決策

**Q1. OpenAPI 規格要涵蓋什麼 API？**
- 先做 Task 範例 API（建議）／只留最小 health API／我有現成的規格要給你

**Q2. 前端的 API client 也要從同一份 openapi.yaml 產生嗎？**
- 要，一起產生（建議）／不要，前端手寫 fetch 封裝

**Q3. Monorepo 用哪個 package manager？**
- pnpm workspaces（建議）／npm workspaces

## 👤 使用者 · 09-06 23:39（回答）

**Q1：** api會有
- 檢視任務
- 建立任務
- 修改任務
- 將任務標記為已完成或未完成
- 刪除任務

**Q2：** 要，一起產生（建議）

**Q3：** pnpm workspaces（建議）

### 🤖 Claude · 09-06 23:40 ~ 23:53 — 工作歷程

**1. 版本查證（不寫死過期版號）**

先查 registry 實際最新版，發現搜尋索引嚴重落後（Maven solr 顯示 Spring Boot 3.5.3，實際 metadata 已到 4.2.0-M1）。逐項確認並檢查 peer dependency 相容性。

決定性發現：`typescript-eslint@8.69.0` 的 peer 是 `typescript >=4.8.4 <6.1.0`，而 TypeScript 最新是 7.0.2 —— 用 TS 7 會讓 lint 整條掛掉。因此**釘 TypeScript 5.9.3**，讓整條工具鏈一致（vue-tsc 3.3.11 需 >=5.0.0 ✓、pinia 需 >=5.6.0 ✓）。

另外 `pinia@4.0.3` 的 `@vue/devtools-api` 是 **非 optional** peer，pnpm 嚴格模式下必須顯式安裝。

**2. 契約先行**

寫 `api/openapi.yaml`（279 行），涵蓋 5 個操作。兩個刻意的設計決定寫進契約的 `description`：

- 完成狀態獨立成 `PATCH /api/tasks/{id}/completion`，`PUT /{id}` 只 replace 可編輯欄位 —— 儲存編輯表單不可能順帶把已完成任務重新打開。
- completion 帶**明確目標狀態**而非 toggle —— toggle 取決於伺服器當下的值，連點兩次會 race。

**3. 後端**

`openapi-generator-maven-plugin` 7.25.0（`spring` generator，`interfaceOnly=true`、`skipDefaultInterface=true`）。先跑一次 generate-sources，讀出產生的 `TasksApi` 實際簽名，再據此寫 controller —— 而不是猜簽名。

`skipDefaultInterface=true` 的用意：controller 少實作一個操作會**編譯失敗**，而不是執行期回 501。

中途把一個用 `addViewControllers` forward 到契約檔的做法**改掉**了 —— 直接用 maven-resources-plugin 把 `api/openapi.yaml` 複製到 `target/classes/static/`，Spring Boot 就會自動以靜態資源提供，不需要任何 MVC 設定。Swagger UI 因此讀的是契約原檔，不是由 annotation 反推的規格。

**4. 前端（嚴格 TDD：Red → Green）**

依規則先寫測試確認紅燈，再寫實作轉綠：

- `src/api/tasks.spec.ts` → `http.ts` + `tasks.ts`（15 tests）
- `src/stores/tasks.spec.ts` → Pinia store
- `src/components/*.spec.ts` → `TaskItem.vue`、`TaskComposer.vue`（10 tests）

測試綁的是**行為背後的原因**：例如「editing a title must not disturb completion state」、「is idempotent, so a double click cannot flip the task back」、「emits the target state rather than a bare toggle」。元件測試一律以可見文字或 ARIA 屬性選取，不綁樣式 class。

遇到兩個實際問題並修掉：
- `@eslint/js` 與 `jiti` 沒宣告成直接相依 → 補上。
- `defineConfig` 與 `@vue/eslint-config-typescript` 在 pnpm 下解析到兩份 `@eslint/core`，`vue-tsc` 報型別錯 → 改用純 flat-config 陣列繞開。

**5. 瀏覽器驗證（規則要求的 Green 階段視覺檢查）**

啟動前後端，375px 實測。找到一個真的問題：**checkbox 觸控目標只有 20×20px**，低於規則要求的 44×44。用一個 44px 的 `<label>` 包住 checkbox（負 margin 讓它不撐高列高）修正。同時補掉 favicon 404。

複驗結果：無橫向捲軸、所有互動元素 ≥44×44、長標題正常換行不截斷、加入→完成→篩選→刪除全程走真後端。

**6. 收尾**

刪掉自己產生的暫存檔（`mobile-375.png`、`.playwright-mcp/`），為 `assets/`、`composables/`、`utils/` 補 `.gitkeep` 讓資料夾結構能進版控，寫 README。

最後刪光所有產物做「模擬全新 clone」驗證，兩端都自己長回來且全綠。

### 🤖 Claude · 09-06 23:53 — 完成回報

Monorepo 已建好，前後端都通過驗證。

**架構：契約優先**

`api/openapi.yaml` 是唯一事實來源，兩端都不手寫傳輸型別：

| 端 | 產生器 | 產物 | 進版控 |
|---|---|---|---|
| 後端 | `openapi-generator-maven-plugin` (spring) | `TasksApi` 介面 + model | 否（`target/`） |
| 前端 | `openapi-typescript` | `schema.d.ts` | 否（`.gitignore`） |

產物一律不進版控，YAML 因此不可能與程式碼失去同步。剛才刪光所有產物重建，兩端都自己長回來且全綠。

契約破壞會變成**編譯失敗**而非執行期錯誤：後端用 `skipDefaultInterface=true`（少實作一個操作就編不過，不會靜默回 501），前端型別直接來自 schema。

**驗證結果**

- 後端 `mvn clean verify`：**8/8 通過**（連續 4 次 clean build）
- 前端 `vitest`：**25/25 通過**；`eslint` 無問題；`vue-tsc` + `vite build` 乾淨
- 五個操作 curl 實測全通，含 400/404 的 RFC 9457 problem details
- 瀏覽器 375px 實測：無橫向捲軸、長標題正常換行、加入→完成→篩選→刪除全程走真後端

**兩個 API 設計決定**

1. **完成狀態獨立 endpoint**：`PUT /{id}` 只 replace 標題與描述，儲存編輯表單不可能順帶把已完成任務重新打開。
2. **`PATCH .../completion` 帶明確目標狀態而非 toggle**：toggle 的結果取決於伺服器當下的值，連點兩次會 race；明確狀態是 idempotent。

**過程中的取捨，需要確認**

- **TypeScript 釘在 5.9.3 而非最新的 7.0.2** —— `typescript-eslint@8.69.0` 的 peer 是 `>=4.8.4 <6.1.0`，用 TS 7 會讓 lint 整條掛掉。
- **Spring Boot 用 3.5.16** —— 題目指定 Spring 3，而目前 latest 已是 4.2.0-M1（milestone）。3.5.16 是 3.x 線最新穩定版。
- **Repository 直接存產生出來的 `Task` model**，沒有另做 domain entity + mapper。在沒有持久化層時第二份表示法沒有要解耦的對象，這也符合規則 2（簡潔至上）。導入真資料庫時在 `TaskRepository` 這個邊界加轉換即可。
- **UI 刻意最小**（清單／新增／完成／刪除／篩選），目的是證明整條產生鏈可運作，不是完整產品。

**兩件需要知道的事**

- `chat-records/` 這個資料夾在本次工作期間出現，**不是我建立的**，我完全沒有動它。
- **我沒有 commit**（未經指示不 commit）。`.gitignore` 是**附加**而非覆寫，原本的 `.claude/` 那行保留著。
- 環境提醒：`JAVA_HOME` 未設定，Maven 實際跑在 **JDK 26**，而 PATH 上的 `java` 是 21。POM 指定 `release 21`，所以 bytecode 正確，但 CI 上建議明確固定 JDK 版本。

---

## 👤 使用者 · 09-07 00:0x

1. chat-records/是我新增的
2. 稍後我在統一建立一個初始化的commit
3. 改成21版比較好 還是 26?

### 🤖 Claude · 09-07 00:0x

查證後回覆。先確認事實再給建議，因為目前 POM 寫 21、Maven 卻跑在 26，這個不一致本身才是要修的東西。

驗證動作：盤點本機 JDK（openjdk 26.0.1 與 openjdk@21 21.0.11 皆已安裝）、用 `javap` 確認實際產出的 bytecode 是 `major version 65`（= Java 21）、查 Java 版本支援時程、查 Spring Boot 3.5 官方支援範圍。

**用 21，不要用 26。** 這題有兩個獨立的硬理由，不是偏好問題：

**為什麼排除 26**

1. **Java 26 是 non-LTS，且支援已經結束。** 2026/03/17 發布，OpenJDK EOL 就在 **2026/09** —— 也就是這個月。non-LTS 只有六個月更新期。
2. **超出 Spring Boot 3.5.16 的支援範圍。** 官方文件原文：「Spring Boot 3.5.16 requires at least Java 17 and is compatible with versions up to and including **Java 25**」。先前的建置是跑在官方沒支援的 JDK 上。

所以真正的選項只有 21 和 25（兩者都是 LTS、都在 Boot 支援範圍內）。選 21 是因為這是面試專案 —— 對方機器上有 21 的機率遠高於 25，而這份程式碼沒有任何地方需要 Java 22–25 的特性。

**澄清一個誤會**

POM **本來就是 21**，沒有需要「改成」。編譯出來的 bytecode 是 `major version 65`（= Java 21），`release=21` 確實生效。

真正錯的是**建置用的 JDK**：`JAVA_HOME` 沒設，Maven 抓到 Homebrew 的 JDK 26。編譯目標對、跑的 JDK 不對，這個不一致才是問題。

**做的修正**

在 `backend/pom.xml` 加了 `maven-enforcer-plugin` 守門（版本由 Boot parent 管理），限制 `[21,26)`：JDK 26 執行會在建置一開始就失敗並印出 `export JAVA_HOME=...`；JDK 21 執行則 `clean verify` 通過、8/8 測試綠。兩條路都實際跑過驗證。

**一個需要決定的操作**

Enforcer 會擋掉預設環境，要跑後端得先設 `JAVA_HOME`。若覺得麻煩，替代方案是 Maven toolchains，可以讓 Maven 自動挑 JDK 21 而不管預設是什麼 —— 但它需要每台機器各自設定一份。

*（來源：[The New Stack — Java 26 lands without an LTS badge](https://thenewstack.io/java-26-performance-ai/)、[Azul — Java 26](https://www.azul.com/glossary/java-26/)、[Spring Boot 3.5 System Requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html)）*

---

## 👤 使用者 · 09-07 00:1x

好的 補上吧

### 🤖 Claude · 09-07 00:1x ~ 00:3x

**查證過程中的關鍵發現**

`maven-toolchains-plugin` 有 `select-jdk-toolchain` goal 可自動探測 JDK。但實測發現**在這台機器上自動探測沒用**：Homebrew 的 `openjdk@21` 是 keg-only，不會安裝到 `/Library/Java/JavaVirtualMachines`（該目錄是空的），而探測只看那裡和 `JAVA_HOME`。所以「靠自動探測」是循環論證 —— 要先設好 `JAVA_HOME` 才找得到，那就失去意義。因此必須用 `~/.m2/toolchains.xml`。

過程中也踩到一個小坑：`useJdk` 的值不是 `Always`。從 plugin jar 用 `javap` 讀出 enum 實際只有 `Never` / `IfSame` / `IfMatch`，正確答案是 **`IfMatch`**（當前 JDK 符合範圍才直接用，否則一定要找到 toolchain）。

**結果**

`pnpm backend:dev` / `backend:build` 現在都自動跑在 JDK 21，即使機器預設 JDK 是 26。實測（`JAVA_HOME` unset）：

| 檢查 | 結果 |
|---|---|
| compiler toolchain | `openjdk@21` ✓ |
| surefire toolchain | `openjdk@21` ✓ |
| `spring-boot:run` 實際執行 | `using Java 21.0.11` ✓ |
| bytecode | `major version 65`（= Java 21）✓ |
| 後端測試 | 8/8 ✓ |
| 前端 | 25/25、lint 乾淨、build 成功 ✓ |

`spring-boot:run` 會遵守 toolchain 這點特別實測過 —— 這是整件事有沒有意義的關鍵，不然 `pnpm backend:dev` 還是會跑在 26。

**把 enforcer 換掉了，不是兩個並存**

原本的 `maven-enforcer-plugin` 檢查的是「Maven 自己跑在哪個 JDK」，但有了 toolchain 之後那已經是錯的檢查對象 —— Maven 可以跑在 26，而編譯／測試／執行都在 21。兩個機制並存只會互相打架。所以改成單一機制。

保護力沒有變弱，用不可能的版本範圍實測過失敗路徑：

```
Cannot find matching toolchain definitions for the following toolchain types:{version=[99,100)}
Define the required toolchains in your ~/.m2/toolchains.xml file.
```

不會默默退回 JDK 26。

**兩件值得知道的事**

1. Maven 的 JDK 自動探測在這台機器上沒用（見上）。
2. `~/.m2/toolchains.xml` 已建立（原本不存在，沒有覆蓋任何東西）。這是 repo 外的使用者層設定。repo 內放了 `backend/toolchains.xml.example` 當範本，README 也寫了 `cp` 指令，reviewer 照做即可。POM 裡沒有任何機器路徑，維持可攜。

**一個更正**

先前回報建置時曾出現一次 `deleteThenNotFound` 測試錯誤。那是**我自己造成的** —— 在同一個指令裡讓兩個 Maven 行程同時操作 `target/`。之後連跑 4 次 `clean test` 全部 8/8 通過，程式碼沒有 flaky 問題。

---

## 👤 使用者 · 09-07 00:3x

請幫我做第一次的初始化commit, msg為chore: initialize project scaffolding

### 🤖 Claude · 09-07 00:35

Commit 前先做了三件事：確認 repo 尚無任何 commit、掃描待進版檔案是否含機密、確認建置產物沒有被納入。

機密掃描命中的全是 CSS design token 與 `@csstools/css-tokenizer`，沒有真的祕密。`node_modules/`、`backend/target/`、`frontend/dist/`、產生的 `schema.d.ts` 都確認未納入。

最後跑一次完整驗證（後端 8/8、前端 25/25、lint 0 錯、build 成功，`JAVA_HOME` unset 走 toolchain 跑 JDK 21）才 commit。

**`f45910b` — chore: initialize project scaffolding**

42 個檔案、6579 行，作者 `allen <a6220498@yahoo.com.tw>`，工作區乾淨。

**兩件值得確認的事**

**1. `docs/` 沒有進 commit —— 這是你自己的設定，不是我漏掉的。**

`.gitignore` 第 26–27 行有一段 `# ---- Design ----` / `docs`，是你加的（我加的區塊只到第 24 行）。所以 `docs/ui-spec.html` 和 `docs/HANDOFF.md` 被排除了。檔案還在硬碟上，沒有動到。

順帶一提，`docs` 沒有斜線，所以它同時會忽略任何叫 `docs` 的檔案；若只想忽略目錄，寫成 `docs/` 比較精確。

**2. `chat-records/screen-design.md` 有進去**（777 行）。你說過那個目錄是你的，所以照「統一的初始化 commit」納入了。

沒有 push，remote 也還沒設定。

---

## 👤 使用者 · 09-07 00:53

請幫我輸出這段session的內容放到chat-records, 名稱叫做project-init

### 🤖 Claude · 09-07 00:53

即本檔。
