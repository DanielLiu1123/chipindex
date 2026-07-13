# 多空间（Space）改造设计

日期：2026-07-13
状态：待评审

## 1. 目标与约束

- **空间概念**：一个「空间」= 一款游戏的独立数据域（例：游戏A、游戏B）。空间之间 session/buy-in 数据完全隔离，互不冲突。
- **玩家全局共享**：`player` 表不分空间，A/B 共用同一玩家池。某玩家只在其参与过的空间的排行榜/统计中出现。
- **零 UI 改动**：不新增输入框、下拉、页面或导航变更。空间的选择完全复用现有登录密码框。
- **空间选择模式**：空间名 = 密码（env 映射）。输入某空间的密码即进入该空间。

## 2. 空间选择机制（复用登录）

env 用 `SPACES` 替代原 `SHARED_PASSWORD`：

```
SPACES=游戏A:密码A,游戏B:密码B
```

- 逗号分隔多个空间；每项 `空间名:密码`。
- **格式限制**：空间名与密码均不得含 `:` 或 `,`（解析分隔符）。文档需向使用者说明。
- 登录时输入的密码在映射中查找 → 命中则进入对应空间；未命中 → 401。
- 因此「切换空间」= 登出后用另一空间的密码登录（零 UI，符合约束）。

## 3. 架构：Cookie 上下文（方案 A）

服务端查询通过 cookie 感知当前空间，调用方（页面/路由）签名不变。

### 3.1 新增 `lib/spaces.ts`

- `parseSpaces(): Map<name, password>` — 解析 `process.env.SPACES`。缺失或空 → 抛错（阻止「无密码空 body 绕过」旧漏洞）。
- `spaceForPassword(pw): string | null` — 反查密码对应空间名。
- `signSpace(name): Promise<string>` — `HMAC-SHA256(key = 该空间密码, message = name)` 的 hex。**每空间独立密钥**，替代原硬编码 `'chipindex'` 密钥，伪造 cookie 需知该空间密码。
- `currentSpace(): Promise<string>` — 读 cookie `chipindex_auth`，格式 `base64url(name).sig`；解出 name → 取其密码 → 重算 sig → 常量时间比对；通过返回 name，否则视为未认证。用 `react` 的 `cache()` 包裹，单请求内只算一次。

Cookie 值格式：`base64url(name) + "." + sig`。name 经 base64url 编码以容纳中文/非 ASCII 且保证 cookie 值合法。

### 3.2 改 `lib/auth.ts`

- 删除单密码 `generateToken`（基于 `SHARED_PASSWORD` + 固定 key）。
- `isAuthenticated()` 改为 `currentSpace()` 成功即认证。
- 常量 `AUTH_COOKIE = 'chipindex_auth'` 保留。

### 3.3 改 `middleware.ts`

- 校验空间 cookie（调用 `spaces.ts` 的验证逻辑，Edge Runtime 用 Web Crypto，与现有一致）。
- 无效/缺失 → 重定向 `/login?next=...`；已认证访问 `/login` → 重定向 `/`。逻辑与现状一致，仅校验函数替换。

### 3.4 改 `app/api/auth/route.ts`

- `POST`：body `{ password }` → `spaceForPassword(password)`；null → 401；否则设 cookie 值 `base64url(name).signSpace(name)`，属性不变（httpOnly/secure/sameSite/30天）。
- 修旧漏洞：显式校验密码非空且命中映射，杜绝 `undefined === undefined` 绕过。
- `DELETE`：登出，清 cookie（不变）。

### 3.5 登录页 `app/login/page.tsx`

- **零改动**。仍是单个密码框，用户输入的是「空间密码」。

## 4. 数据层

### 4.1 Schema

仅 `session` 加 `space` 列（玩家全局，participant/buy_in 经 `session_id` 继承空间，无需自身列）。

非破坏迁移（保留现有数据）：

```sql
alter table session add column if not exists space text;
update session set space = '<默认空间名>' where space is null;  -- 现有数据归入选定的一个空间
alter table session alter column space set not null;
create index if not exists idx_session_space on session(space);
```

`<默认空间名>` 由使用者指定（现有数据属于哪款游戏）。

`schema.sql` 全量脚本同步：`session` 定义加 `space text not null` + 索引。

### 4.2 查询注入（`lib/queries.ts`）

7 处 `session` 读加 `.eq('space', await currentSpace())`：

| 函数 | 行 |
|---|---|
| `getLeaderboardSessions` | 69 |
| `getSessionsList` | 102 |
| `getSessionStatus` | 154 |
| `getSessionDetail` | 160 |
| `getSessionForEdit` | 201 |
| `getLiveSession` | 246 |
| `getPlayerDetail`（session 查询） | 301 |

- `session_participant` / `buy_in` 查询**不改**：始终以空间过滤后的 `sessionIds`/`session_id` 为键，天然隔离。
- `getPlayers` / `playerNameMap` **不改**：玩家全局。
- `getPlayerDetail`：L295 按 player 查参与记录跨空间，但 L301 session 查询加 space 过滤后，非本空间 session 被剔除，玩家详情自动只显示当前空间战绩。✅

### 4.3 写入注入（`lib/mutations.ts`）

- **插入注入 space**：`startSession`（L127）、`importSession`（L79）的 session insert 加 `space: await currentSpace()`。
- **按 id 操作前置空间校验**（防跨空间越权写）：新增
  ```ts
  async function requireSessionInSpace(id: string): Promise<void>
  ```
  读 `session` where `id` 且 `space = currentSpace()`；不存在 → 404。在以下函数**最先**调用（先于任何 update/delete）：
  - `requireOpenSession`（L19，合并空间校验：查 status + space）→ 覆盖 `addParticipant`、`addBuyin`
  - `updateSettledSession`（L163）— 在 L191 的并行 update/delete 批次**之前**校验，避免跨空间误删
  - `softDeleteSession`（L231）
  - `removeParticipant`（L254）
- `createPlayer` / `renamePlayer` **不改**：玩家全局。

## 5. 安全边界

- **空间隔离在应用层，不在 RLS**。Supabase 用共享 anon key，RLS 策略仍 `to anon using(true)`；空间过滤由 `.eq('space', ...)` 与前置校验保证。anon key 泄露者可绕过应用直连读写全部空间 —— 内部工具场景可接受，需向使用者说明勿把 anon key 视为空间隔离屏障。
- **Cookie 防伪**：sig = HMAC(空间密码, name)。伪造他空间 cookie 需知该空间密码。较旧方案（固定 key `'chipindex'`）显著加强。
- **修复旧绕过漏洞**：`SPACES` 未配或密码空一律拒登，杜绝空 body 绕过。

## 6. 影响文件清单

| 文件 | 改动 |
|---|---|
| `.env.example` | `SHARED_PASSWORD` → `SPACES=游戏A:密码A,游戏B:密码B` |
| `lib/spaces.ts`（新） | 解析、反查、签名、`currentSpace()` |
| `lib/auth.ts` | 改用 `currentSpace()`，删单密码 token |
| `middleware.ts` | 校验空间 cookie |
| `app/api/auth/route.ts` | 密码→空间映射，修绕过漏洞 |
| `lib/queries.ts` | 7 处 session 读加 space 过滤 |
| `lib/mutations.ts` | insert 注入 space + `requireSessionInSpace` 前置校验 |
| `schema.sql` | `session.space` 列 + 迁移 SQL + 索引 |
| `app/login/page.tsx` | 不变（零 UI） |

## 7. 测试

- **单元**（vitest）：`parseSpaces` 解析（多空间、格式非法、空值）；`spaceForPassword` 命中/未命中；`signSpace`/`currentSpace` 签名往返与篡改拒绝。
- **隔离**：构造 A/B 两空间各一 session，断言 A 的 cookie 下 `getSessionsList`/排行榜只见 A 的 session；`getSessionDetail(B的id)` 在 A 上下文返回 null。
- **越权写**：A 上下文调用 `softDeleteSession(B的id)` / `updateSettledSession(B的id)` → 404，B 数据不变。
- **玩家共享**：同一 player 在 A、B 各有战绩，player 列表跨空间可见，但 `getPlayerDetail` 只聚合当前空间战绩。
- **绕过修复**：`SPACES` 未配 / 空密码 POST `/api/auth` → 401。

## 8. YAGNI（明确不做）

- 不做空间管理 UI、空间切换菜单、空间创建页（违反零 UI；加空间靠改 env）。
- participant/buy_in 不加 space 列（经 session 继承足够）。
- 不引入用户系统、每用户权限（仍是空间级共享密码）。
- 不做 RLS 层空间隔离（应用层足够，anon key 模型下 RLS 强隔离需 service-role 重构，超范围）。
