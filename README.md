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
pnpm install                  # 安裝前端相依（後端用 Maven）

pnpm backend:dev              # 後端  → http://localhost:8080
pnpm dev                      # 前端  → http://localhost:5173
```

Vite 會把 `/api` proxy 到 `localhost:8080`，因此開發環境同源、後端不需要設定 CORS，
前端在開發與正式環境呼叫的都是同一組 `/api/...` 路徑。

- Swagger UI：<http://localhost:8080/swagger-ui.html>（直接讀 `api/openapi.yaml` 本身，
  不是由 annotation 反推出來的規格）
- 契約原檔：<http://localhost:8080/openapi.yaml>

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

兩個刻意的設計決定：

1. **完成狀態獨立成一個 endpoint**。`PUT /{id}` 只replace 可編輯欄位（標題、描述），
   儲存編輯表單因此不可能順帶把已完成的任務重新打開。
2. **`PATCH .../completion` 帶明確的目標狀態，而不是 toggle**。toggle 的結果取決於
   伺服器當下的值，連點兩次或多裝置同時操作會 race；帶明確狀態則是 idempotent。

錯誤一律以 RFC 9457 problem details 回傳，對應契約中的 `Problem` schema。

## 領域模型

模型和 endpoint 一樣定義在 [`api/openapi.yaml`](api/openapi.yaml) 的 `components.schemas`，
兩端的表示法都由它產生，沒有任何手寫的傳輸型別。

### `Task`

| 欄位 | 契約 | Java | TypeScript | 必填 |
|---|---|---|---|---|
| `id` | `string($uuid)` | `UUID` | `string` | ✔（伺服器產生） |
| `title` | `string`，1–200 字 | `String` | `string` | ✔ |
| `description` | `string`，≤ 2000 字，nullable | `@Nullable String` | `string \| null` | — |
| `completed` | `boolean` | `Boolean` | `boolean` | ✔ |
| `createdAt` | `string($date-time)` | `OffsetDateTime` | `string` | ✔（伺服器產生） |
| `updatedAt` | `string($date-time)` | `OffsetDateTime` | `string` | ✔（伺服器產生） |

長度限制寫在契約裡，後端因此拿到產生出來的 `@Size` / `@NotNull`，違反時由 Spring 直接回
400 problem details，controller 不需要自己檢查。（`openapi-typescript` 不會把長度帶進型別，
所以前端 `TaskComposer.vue` 的 `maxlength` 是手寫的 UI 提示，實際把關的仍是後端。）

### 請求 payload

`Task` 只作為回應。三個寫入操作各有自己的 schema，刻意不接受整個 `Task`：

| Schema | 用於 | 欄位 |
|---|---|---|
| `CreateTaskRequest` | `POST /api/tasks` | `title`（必填）、`description`；新任務一律未完成 |
| `UpdateTaskRequest` | `PUT /api/tasks/{id}` | `title`（必填）、`description` |
| `TaskCompletionRequest` | `PATCH /api/tasks/{id}/completion` | `completed`（必填） |

`id`、`createdAt`、`updatedAt` 都不在任何 payload 裡，`completed` 也只出現在它自己的
endpoint —— 上一節那兩個設計決定因此是型別層級的保證，而不只是 controller 裡的約定。

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

技術棧與資料夾結構依 `.claude/frontend/rules` 制定：

```
frontend/src/
├── api/            # http.ts (fetch + ApiError)、tasks.ts (契約型別化的 5 個操作)
│   └── generated/  # openapi-typescript 產物，不進版控
├── assets/
├── components/     # TaskItem.vue、TaskComposer.vue (+ *.spec.ts)
├── composables/
├── stores/         # Pinia：tasks.ts (+ tasks.spec.ts)
├── styles/         # _core.scss — Tailwind 表達不了的共用 SCSS
├── types/          # task.ts — 對外重新匯出契約型別
├── utils/
├── App.vue
└── style.css       # Tailwind 4 設定與 @theme 色票（沒有 tailwind.config.js）
```

- **Tailwind 4** 沒有 `tailwind.config.js`，設計 token 全部寫在 `src/style.css` 的
  `@theme` 區塊；深色模式由 `prefers-color-scheme` 重新定義同一組 token 完成，
  模板中不出現 `dark:` variant。
- **SCSS** 只補 Tailwind 表達不了的部分（例：`prefers-reduced-motion` 保護的動畫）。
  透過 Vite 的 `loadPaths` 設定，任何元件都可以直接 `@use 'core' as core;`。

## 後端

```
backend/src/main/java/com/delta/interview/
├── DeltaInterviewApplication.java
├── common/   # Clock bean、TaskNotFoundException → 404 problem detail
└── task/     # TaskController (implements TasksApi)、TaskRepository
```

目前以 `ConcurrentHashMap` 作為記憶體儲存，並**直接存放產生出來的 `Task` model**，
沒有另外做一層 domain entity 與 mapper：在沒有持久化層的情況下，第二份表示法
沒有要解耦的對象。導入真正的資料庫時，在 `TaskRepository` 這個邊界加入
persistence entity 與轉換即可，controller 與契約都不需要變動。
