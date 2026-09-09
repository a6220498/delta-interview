# Delta Interview — Monorepo

Vue 3 前端與 Spring Boot 3 後端，兩邊的 API 型別都由**同一份 OpenAPI 契約產生**。

```
delta-interview/
├── api/
│   └── openapi.yaml          ← 唯一的事實來源 (single source of truth)
├── frontend/                 ← Vue 3 + TypeScript + Vite + Tailwind 4 + SCSS
├── backend/                  ← Spring Boot 3 + Java 21 (Maven)
├── package.json              ← pnpm workspace 根目錄
└── pnpm-workspace.yaml
```

## 契約優先 (Contract-first)

`api/openapi.yaml` 定義了全部 5 個任務操作。兩端都**不手寫傳輸型別**：

| 端 | 產生器 | 產物 | 是否進版控 |
|---|---|---|---|
| `backend/` | `openapi-generator-maven-plugin` (`spring`) | `TasksApi` 介面 + model | 否 (`target/`) |
| `frontend/` | `openapi-typescript` | `src/api/generated/schema.d.ts` | 否 (`.gitignore`) |

產物一律不進版控，因此 YAML 不可能與程式碼失去同步。改了契約之後：

- 後端：`skipDefaultInterface=true`，controller 少實作一個操作就**編譯失敗**（而不是執行期回 501）。
- 前端：型別直接來自 schema，欄位改名會讓 `vue-tsc` **編譯失敗**。

## 環境需求

| 工具 | 版本 |
|---|---|
| Node | >= 20 |
| pnpm | >= 10 |
| **JDK** | **21 ~ 25（建置目標為 21）** |
| Maven | >= 3.9.6（本專案不附 wrapper，請用系統安裝的 `mvn`） |

後端鎖定 Java 21：它是 LTS，且 Spring Boot 3.5.16 官方支援範圍是 Java 17–25。
Java 26 是 non-LTS、OpenJDK 支援已於 2026/09 結束，**且超出 Boot 3.5.16 的支援範圍**。

建置**不依賴 `JAVA_HOME`**：`maven-toolchains-plugin` 會挑一個符合 `[21,26)` 的 JDK
來編譯、測試與 `spring-boot:run`，不管 Maven 自己啟動在哪個 JDK。
找不到符合的 toolchain 就直接建置失敗，不會默默退回較新的預設 JDK。

多數環境（Linux 套件、SDKMAN、Temurin 安裝檔）可自動探測，不需任何設定。
**macOS / Homebrew 需要一次性設定**：keg-only 的 `openjdk@21` 不會安裝到
`/Library/Java/JavaVirtualMachines`，Maven 探測不到它 ——
請把 [`backend/toolchains.xml.example`](backend/toolchains.xml.example)
複製成 `~/.m2/toolchains.xml`（必要時修改 `<jdkHome>` 路徑）：

```bash
cp backend/toolchains.xml.example ~/.m2/toolchains.xml
```

## 快速開始

```bash
pnpm install                  # 安裝前端相依（後端相依由 Maven 自行下載）

# macOS / Homebrew 需要這一行，其他環境多半不用。少了它，後端會停在
# 「Cannot find matching toolchain definitions」而不是啟動 —— 理由見〈環境需求〉。
cp backend/toolchains.xml.example ~/.m2/toolchains.xml

pnpm backend:dev              # 後端  → http://localhost:8080
pnpm dev                      # 前端  → http://localhost:5173
```

Vite 會把 `/api` proxy 到 `localhost:8080`，因此開發環境同源、後端不需要設定 CORS，
前端在開發與正式環境呼叫的都是同一組 `/api/...` 路徑。

- Swagger UI：<http://localhost:8080/swagger-ui.html>（直接讀 `api/openapi.yaml` 本身，
  不是由 annotation 反推出來的規格）
- 契約原檔：<http://localhost:8080/openapi.yaml>

任務存在後端的記憶體裡（`ConcurrentHashMap`），**沒有預載資料**：第一次打開是一片空看板，
卡片要自己建，後端一重啟就清空。要快速塞幾張進去，可以直接打 `POST /api/tasks`：

```bash
curl -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' \
  -d '{"title":"第一張單","category":1}'
```

## 常用指令

| 指令 | 作用 |
|---|---|
| `pnpm generate` | 由契約重新產生前端型別 |
| `pnpm dev` / `pnpm build` | 前端開發伺服器 / 正式建置（含 `vue-tsc` 型別檢查） |
| `pnpm test` | 前端 Vitest |
| `pnpm lint` | 前端 ESLint |
| `pnpm backend:dev` | 啟動 Spring Boot |
| `pnpm backend:test` | 後端 MockMvc 契約測試 |
| `pnpm backend:build` | 後端完整建置 |

`generate` 已掛在 `predev` / `prebuild` / `pretest` / `pretype-check`，
所以日常流程不需要記得手動執行。

## API

| 操作 | Endpoint |
|---|---|
| 檢視任務（列表，可依完成狀態篩選） | `GET /api/tasks?completed=` |
| 檢視任務（單筆） | `GET /api/tasks/{id}` |
| 建立任務 | `POST /api/tasks` |
| 修改任務 | `PUT /api/tasks/{id}` |
| 標記完成 / 未完成 | `PATCH /api/tasks/{id}/completion` |
| 刪除任務 | `DELETE /api/tasks/{id}` |

四個刻意的設計決定：

1. **完成狀態獨立成一個 endpoint**。`PUT /{id}` 只 replace 可編輯欄位（標題、描述、
   類別、到期日），儲存編輯表單因此不可能順帶把已完成的任務重新打開。
2. **`PATCH .../completion` 帶明確的目標狀態，而不是 toggle**。toggle 的結果取決於
   伺服器當下的值，連點兩次或多裝置同時操作會 race；帶明確狀態則是 idempotent。
   也因為帶的是目標狀態，`{"completed": false}` 本身就是「改回未完成」，
   **不需要另開一支反向 endpoint** —— 同一件事有兩個入口只會讓兩邊語意慢慢分岔。
3. **`id` 與工單編號是兩個東西**。`id` 給機器用（路由、請求、快取鍵），永遠不變；
   人看的編號是 `category` + `sequence` 這一對。詳見〈領域模型〉。
4. **列表不回傳 `description`**。看板上的卡片不畫說明，而它是任務裡唯一沒有小上限的
   欄位（2000 字，標題的十倍）—— 每次載入、每次重整都把 payload 裡最大的欄位送給一個
   從來不讀它的畫面，代價全花在看不到的地方。要看細節的人（編輯工單）用
   `GET /{id}` 拿那一張就好。詳見〈領域模型〉。

錯誤一律以 RFC 9457 problem details 回傳，對應契約中的 `Problem` schema。

## 領域模型

模型和 endpoint 一樣定義在 [`api/openapi.yaml`](api/openapi.yaml) 的 `components.schemas`，
兩端的表示法都由它產生，沒有任何手寫的傳輸型別。

### 回應的兩個形狀：`TaskSummary` 與 `Task`

| Schema | 用於 | 內容 |
|---|---|---|
| `TaskSummary` | `GET /api/tasks`（列表） | 除了 `description` 以外的所有欄位 |
| `Task` | `GET /api/tasks/{id}`，以及建立／修改／標記完成的回應 | `TaskSummary` + `description` |

`Task` 在契約裡是用 `allOf` 從 `TaskSummary` 組出來的，而不是抄第二份：卡片上要多畫一個
欄位時只有一個地方要加，兩個形狀因此不會慢慢分岔。兩邊的產生器都會把 `allOf` 攤平 ——
Java 得到兩個各自獨立的 model，TypeScript 得到 `TaskSummary & { description }`。

分開的理由是卡片不畫說明，而 `description` 是任務裡唯一沒有小上限的欄位；代價是**編輯
工單時要多一次 `GET /{id}`**，由前端 `App.vue` 的 `openEdit` 負責。這一次請求不是可有可無
的：直接拿列表那一列開表單，說明欄會是空的，而存檔會把使用者從來沒看過的內容清掉。

反過來說，**卡片上畫得出來的東西都必須留在 `TaskSummary`**。一個列表缺、卡片又要的欄位，
會把「一次列表請求」變成「每列一次請求」。

### `Task`

| 欄位 | 契約 | Java | TypeScript | 必填 |
|---|---|---|---|---|
| `id` | `string($uuid)` | `UUID` | `string` | ✔（伺服器產生） |
| `category` | `integer($int32)` `enum`：`0` / `1` | `TaskCategory` | `0 \| 1` | ✔ |
| `sequence` | `integer($int32)`，≥ 1 | `Integer` | `number` | ✔（伺服器產生） |
| `title` | `string`，1–200 字 | `String` | `string` | ✔ |
| `description` | `string`，≤ 2000 字，nullable | `@Nullable String` | `string \| null` | —（只在 `Task`，列表不回傳） |
| `completed` | `boolean` | `Boolean` | `boolean` | ✔ |
| `dueDate` | `string($date)`，nullable | `@Nullable LocalDate` | `string \| null` | — |
| `createdAt` | `string($date-time)` | `OffsetDateTime` | `string` | ✔（伺服器產生） |
| `updatedAt` | `string($date-time)` | `OffsetDateTime` | `string` | ✔（伺服器產生） |

長度限制寫在契約裡，後端因此拿到產生出來的 `@Size` / `@NotNull`，違反時由 Spring 直接回
400 problem details，controller 不需要自己檢查。（`openapi-typescript` 不會把長度帶進型別，
所以前端在 `TaskDialog/const/task-dialog.ts` 手寫了一份 `FIELD_LIMITS`，當成兩個文字欄位的
`maxlength`；那只是 UI 提示，實際把關的仍是後端。）
標題長度是**驗證**而不是**顯示**：畫面不主動印「還剩幾字」，只有超出上限、驗證沒過時才跳錯誤。

#### `category`：數字碼而不是名字

`category` 在契約裡是一個**封閉的數字 enum**：

| 值 | 類別 | 顯示前綴 | Java | TypeScript |
|---|---|---|---|---|
| `0` | feature | `feat` | `TaskCategory.FEATURE` | `0` |
| `1` | bug | `bug` | `TaskCategory.BUG` | `1` |

這張表只定義在 [`api/openapi.yaml`](api/openapi.yaml) 的 `TaskCategory` 一處。後端靠
`x-enum-varnames` 拿到具名常數（`TaskCategory.FEATURE` / `BUG`），程式碼裡不會出現裸的
`0` / `1`；前端拿到的是 `0 | 1`，名字與前綴在**畫面邊界**上查一次表換掉，其餘地方一律傳碼。

封閉 enum 而不是任意整數：範圍外的碼（例如 `2`）在邊界就是 400，不會變成一張畫不出來的卡片。
舊契約的字串寫法（`"category":"bug"`）同樣被擋掉 —— 沒跟上這次改動的客戶端會直接收到 400，
而不是把壞資料寫進來。

#### 工單編號：`category` + `sequence`

畫面上的工單編號不是一個獨立欄位，而是 `category` 與 `sequence` 這一對算出來的：

```
`${PREFIX[category]}-${String(sequence).padStart(4, '0')}`   →   bug-0007 / feat-0003
                                                                 （PREFIX: 0 → feat、1 → bug）
```

前綴查表與補零到四位數都是**顯示**行為，由前端負責；契約走的是原始數字，後端不回傳格式化字串。

兩個類別**各有一個獨立的計數器**，所以 `bug-0001` 與 `feat-0001` 會同時存在 ——
唯一的是（`category`, `sequence`）這一對，不是 `sequence` 本身。

因為兩個計數器獨立，**改類別時會從目標類別的計數器重新發號**：`feat-0003` 改成 `bug`（`1`）
會變成例如 `bug-0007`，而不是沿用 `0003` 去跟既有的 `bug-0003` 撞號；原本的號碼直接作廢
不回收。這件事之所以無痛，正是因為 `id` 是獨立的 uuid：換號不會動到任何網址或飛在路上的請求。

#### `dueDate` 與逾期

`dueDate` 是**日期**不是時間戳：任務是「某天」到期而不是「某個瞬間」到期，帶時區的時間戳
只會讓同一張單在不同時區看起來一個逾期一個沒有。

契約裡**沒有** `overdue` 旗標。逾期是 `dueDate < 今天 && !completed`，由前端自己算 ——
伺服器算好的旗標在瀏覽器裡跨過午夜就過期了，而前端本來就要重算。

### 請求 payload

`Task` 只作為回應。三個寫入操作各有自己的 schema，刻意不接受整個 `Task`：

| Schema | 用於 | 欄位 |
|---|---|---|
| `CreateTaskRequest` | `POST /api/tasks` | `title`、`category`（皆必填）、`description`、`dueDate`；新任務一律未完成 |
| `UpdateTaskRequest` | `PUT /api/tasks/{id}` | `title`、`category`（皆必填）、`description`、`dueDate` |
| `TaskCompletionRequest` | `PATCH /api/tasks/{id}/completion` | `completed`（必填） |

`id`、`sequence`、`createdAt`、`updatedAt` 都不在任何 payload 裡，`completed` 也只出現在
它自己的 endpoint —— 上一節那三個設計決定因此是型別層級的保證，而不只是 controller 裡的約定。
特別是 `sequence`：它不進 payload，客戶端就沒有辦法自己編一個已經有人在用的號碼。

`UpdateTaskRequest` 是整批取代，所以**省略 `description` 或 `dueDate` 等於清空**。
`category` 設成必填也是同一個理由：一張能把任務搬到另一個類別的表單必須講清楚它要落在哪裡，
省略的話「沒有改」和「清掉」就分不出來了。

### `Problem`

RFC 9457 problem details，對應 Spring 的 `ProblemDetail`：`type`、`title`（必填）、
`status`（必填）、`detail`、`instance`。

### 存取產生出來的型別

| 端 | import 來源 | 產生方式 |
|---|---|---|
| 後端 | `com.delta.interview.api.model.*`（實際檔案在 `backend/target/generated-sources/openapi/`） | Maven `generate-sources`，即任何一個 `pnpm backend:*` |
| 前端 | [`@/types/task`](frontend/src/types/task.ts) | `pnpm generate` → `src/api/generated/schema.d.ts` |

前端程式碼一律 import [`src/types/task.ts`](frontend/src/types/task.ts) 這層重新匯出，不直接碰
`api/generated/`：產生器的輸出路徑因此只是實作細節，換掉產生器不必動到每個呼叫端。

後端把產生出來的 `Task` 直接當成儲存的形狀，沒有另外一層 domain entity —— 理由見〈後端〉。

## 前端

```
frontend/src/
├── api/                    # http.ts (fetch + ApiError)、tasks.ts (契約型別化的 5 個操作)
│   └── generated/          # openapi-typescript 產物，不進版控
├── assets/
├── components/             # 一個元件一個資料夾
│   ├── CardDetailDialog/   #   工單明細窗
│   ├── DeleteDialog/       #   刪除確認
│   ├── Header/             #   抬頭
│   ├── LoadFailure/        #   載入失敗
│   ├── RackSwitch/         #   375px 版型的架別切換
│   ├── TaskDialog/         #   新增／編輯表單
│   └── TaskList/           #   托盤，另含 Card.vue 與 RowMenu.vue
├── composables/
├── const/                  # 跨元件的常數：task.ts (架別)、interaction.ts (寫入節流)
├── layouts/
│   └── MainLayout/         # 看板版型與右下角浮動新增鈕
├── stores/                 # Pinia：tasks.ts
├── styles/                 # _core.scss — Tailwind 表達不了的共用 SCSS
├── types/                  # task.ts — 對外重新匯出契約型別
├── utils/                  # task.ts (工單編號、逾期、日期等顯示轉換)、throttle.ts
├── App.vue
├── main.ts
└── style.css               # Tailwind 4 設定與 @theme 色票（沒有 tailwind.config.js）
```

- **一個元件一個資料夾**：進入點固定是 `index.vue`，測試是同層的 `index.spec.ts`，
  只有這個元件用得到的常數與型別放它自己的 `const/` 與 `types/`。共用的才升到
  `src/const/`、`src/types/` —— 例如三顆寫入按鈕共用的節流毫秒數。
- **Tailwind 4** 沒有 `tailwind.config.js`，設計 token 全部寫在 `src/style.css` 的
  `@theme` 區塊；深色模式由 `prefers-color-scheme` 重新定義同一組 token 完成，
  模板中不出現 `dark:` variant。
- **SCSS** 只補 Tailwind 表達不了的部分（例：`prefers-reduced-motion` 保護的動畫）。
  透過 Vite 的 `loadPaths` 設定，任何元件都可以直接 `@use 'core' as core;`。

## 後端

```
backend/src/main/java/com/delta/interview/
├── DeltaInterviewApplication.java
├── common/   # ApplicationConfiguration (Clock bean)、GlobalExceptionHandler (→ 404 problem detail)
└── task/     # TaskController (implements TasksApi)、TaskRepository、TaskNotFoundException
```

目前以 `ConcurrentHashMap` 作為記憶體儲存，並**直接存放產生出來的 `Task` model**，
沒有另外做一層 domain entity 與 mapper：在沒有持久化層的情況下，第二份表示法
沒有要解耦的對象。導入真正的資料庫時，在 `TaskRepository` 這個邊界加入
persistence entity 與轉換即可，controller 與契約都不需要變動。

倉庫一律存整張任務；**收窄成 `TaskSummary` 是在 `TaskController` 做的**。回應帶哪些欄位
是契約的決定，倉庫的職責則是把任務完整地留著 —— 一個只發得出摘要的倉庫，就沒有東西可以
回答 `GET /api/tasks/{id}` 了。
