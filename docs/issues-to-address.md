# Med Tracker 待处理问题清单

> 记录日期：2026-06-02
>
> 目的：把项目巡检发现的问题固定下来，后续按优先级一个一个处理。

## 当前基线

- 分支：`main`
- 工作区：记录时为干净状态
- 最近已完成：
  - API 保存/删除失败时 UI 回滚
  - toast 替代 `alert()`
  - 库存数据迁移到 React Query，并支持乐观更新 + 失败回滚
  - session/login/logout 迁移到 React Query，登出清理库存缓存
- 质量门禁：
  - `npm --prefix web run test`：通过，4 files / 14 tests
  - `npm run lint`：通过
  - `npm run build`：通过
  - `npm audit --omit=dev --prefix web && npm audit --omit=dev --prefix api`：0 vulnerabilities

---

## 处理队列

### 1. 加载失败 / session 过期错误态处理

**优先级：P1**

**问题：**

`profiles` 和 `trackers` 已经通过 React Query 读取，但主界面目前主要处理了 loading 状态：

```ts
const loading = profilesQuery.isLoading || trackersQuery.isLoading;
```

如果 API 请求失败，例如：

- 后端服务不可用
- 数据库连接失败
- 网络异常
- session 过期导致 401

界面缺少清晰的错误态和恢复入口。

**建议目标：**

- 增加主界面错误态组件，例如 `InventoryErrorState`
- 显示用户可理解的错误信息
- 提供“重试”按钮
- 对 401 / `Authentication required` 做特殊处理：
  - 清理 session cache
  - 清理 inventory cache
  - 回到登录页
  - toast 提示“登录已过期，请重新登录”

**涉及文件：**

- `web/src/App.tsx`
- `web/src/utils/apiClient.ts`，如需区分 HTTP status
- `web/src/utils/sessionQuery.ts`
- 可能新增测试文件

**验收：**

- profiles/trackers 加载失败时不会只显示空数据或卡住
- 401 时返回登录页并清理缓存
- `npm --prefix web run test`
- `npm run lint`
- `npm run build`

---

### 2. 替换剩余 `window.confirm()` 为自定义确认弹窗

**优先级：P1**

**问题：**

项目已经用 toast 替代了 `alert()`，但还剩两个浏览器原生确认框：

```text
web/src/components/DrugLibraryPanel.tsx
web/src/components/InventoryDashboard.tsx
```

分别用于：

- 删除药品规格
- 停用库存追踪

这会导致 UI 体验不统一。

**建议目标：**

- 新增项目风格的 confirm dialog
- 删除/停用危险操作统一走自定义弹窗
- 保留明确的取消与确认按钮
- 确认后才触发 mutation

**涉及文件：**

- `web/src/App.tsx`
- `web/src/components/DrugLibraryPanel.tsx`
- `web/src/components/InventoryDashboard.tsx`
- `web/src/index.css`
- 可能新增 `web/src/utils/confirm.ts` 或组件文件

**验收：**

- 搜索 `window.confirm` 为 0
- 删除和停用操作仍需二次确认
- `npm --prefix web run test`
- `npm run lint`
- `npm run build`

---

### 3. 清理遗留 `StorageUtils.ts`

**优先级：P2**

**问题：**

`web/src/utils/StorageUtils.ts` 中的 `CloudStorageUtils` 基本已经成为遗留封装。它的失败模式是：

```ts
catch {
  return false;
}
```

这和 React Query 更适合的 `throw` / rejected Promise 错误流不一致，容易让后续维护者混淆：

- 新代码应该用 `ApiClient` 还是 `CloudStorageUtils`？
- 失败应该 `throw` 还是 `return false`？

**建议目标：**

- 确认没有引用 `CloudStorageUtils`
- 删除 `web/src/utils/StorageUtils.ts`
- 如 README 或注释仍提到，需要同步更新

**涉及文件：**

- `web/src/utils/StorageUtils.ts`
- 可能涉及文档或 import 清理

**验收：**

- 搜索 `CloudStorageUtils` 无业务引用
- `npm --prefix web run test`
- `npm run lint`
- `npm run build`

---

### 4. 增加后端 API 自动化测试

**优先级：P2**

**问题：**

前端已有 Vitest 测试，但后端 Express API 目前没有自动化测试。对私有药品库存应用来说，后端测试尤其重要。

**建议目标：**

覆盖核心 API：

- 登录成功/失败
- session cookie
- `/api/session`
- profiles CRUD
- trackers CRUD
- 非法输入校验
- 不同用户数据隔离

尤其要验证：

> 用户 A 不能读取、修改、删除用户 B 的 profiles/trackers。

**涉及文件：**

- `api/package.json`
- 可能新增 `api/test/*`
- 可能需要测试数据库初始化脚本

**验收：**

- 新增后端测试命令，例如 `npm --prefix api test`
- 数据隔离测试通过
- 不影响现有前端 test/lint/build

---

### 5. 增加前端交互测试

**优先级：P2**

**问题：**

当前前端测试主要覆盖纯函数和 query helper：

- `stateUpdates.test.ts`
- `toast.test.ts`
- `inventoryQuery.test.ts`
- `sessionQuery.test.ts`

还没有覆盖真实用户交互。

**建议目标：**

引入 React Testing Library，覆盖：

- 登录失败显示 toast
- 删除/停用弹出确认框
- 保存失败后 UI 回滚
- session 过期返回登录页

**涉及文件：**

- `web/package.json`
- `web/src/**/*.test.tsx`
- 可能新增测试 setup

**验收：**

- 交互测试可稳定运行
- `npm --prefix web run test`
- `npm run lint`
- `npm run build`

---

### 6. 后端类型/schema 化

**优先级：P3**

**问题：**

前端是 TypeScript，后端仍是 JavaScript。API response 与前端类型之间主要靠约定维持。

**建议方向：**

后续可以考虑：

- 后端迁移 TypeScript
- 或引入 Zod 做 request/response schema
- 或至少为 API response 增加运行时校验

**涉及文件：**

- `api/src/server.js`
- `api/src/db.js`
- `web/src/utils/apiClient.ts`

**验收：**

- API 输入输出边界更明确
- 类型或 schema 能覆盖 profiles/trackers/session

---

## 推荐执行顺序

1. 加载失败 / session 过期错误态处理
2. 替换剩余 `window.confirm()` 为自定义确认弹窗
3. 清理遗留 `StorageUtils.ts`
4. 增加后端 API 自动化测试
5. 增加前端交互测试
6. 后端类型/schema 化

## 执行约定

- 一次只处理一个问题。
- 每个问题尽量采用 TDD：先写失败测试，再实现。
- 每次改完运行：

```bash
npm --prefix web run test
npm run lint
npm run build
```

- 涉及后端测试后，还要运行后端测试命令。
- **每次 `git commit` 前必须先征得用户确认。**
