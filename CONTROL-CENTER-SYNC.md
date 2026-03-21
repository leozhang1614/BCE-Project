# Control Center 与 BCE 数据同步方案

**版本：** 1.0  
**更新日期：** 2026-03-20  
**架构设计：** 匠心 (CTO)

---

## 🎯 磊哥需求

> Control Center 功能不改变，但涉及到任务流转的部分要与 BCE 同步。
> Control Center 包含的任务信息必须与 BCE 完全一致，不能有差异！

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────┐
│              Control Center (4310 端口)                   │
│                                                         │
│  UI 展示层：                                             │
│  - 任务列表页面                                          │
│  - 任务详情页面                                          │
│  - 任务统计面板                                          │
│                                                         │
│  数据源：                                               │
│  - 通过 /api/sync 从 BCE 获取任务数据                     │
│  - 只读展示，不修改数据                                   │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP 请求
┌─────────────────────────────────────────────────────────┐
│                   BCE (3000 端口)                        │
│                                                         │
│  数据主存储：                                            │
│  - 任务创建/分配/执行/验收                               │
│  - 子任务拆分                                            │
│  - 评论系统                                              │
│  - 飞书通知                                              │
│                                                         │
│  同步 API：                                             │
│  - GET /api/sync/tasks      - 任务列表                  │
│  - GET /api/sync/tasks/:id  - 任务详情                  │
│  - GET /api/sync/tasks/stats - 任务统计                 │
│  - GET /api/sync/health     - 健康检查                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔗 同步 API 端点

### 1. 获取任务列表
```http
GET http://192.168.31.187:3000/api/sync/tasks
```

**响应示例：**
```json
{
  "success": true,
  "source": "BCE",
  "syncedAt": "2026-03-20T05:49:06.493Z",
  "data": [
    {
      "id": "4ee0eb83-f71a-407b-a292-63d9f27a679d",
      "title": "【飞书通知演示】BCE 系统正式上线测试",
      "status": "reviewing",
      "assignee": "匠心",
      "creator": "磊哥",
      "priority": "P0",
      "createdAt": "2026-03-20T05:33:28.148Z",
      "updatedAt": "2026-03-20T05:39:51.937Z"
    }
  ]
}
```

---

### 2. 获取任务详情
```http
GET http://192.168.31.187:3000/api/sync/tasks/:id
```

**响应示例：**
```json
{
  "success": true,
  "source": "BCE",
  "syncedAt": "2026-03-20T05:49:06.493Z",
  "data": {
    "id": "4ee0eb83-f71a-407b-a292-63d9f27a679d",
    "title": "任务标题",
    "description": "任务描述",
    "status": "reviewing",
    "assignee": "匠心",
    "creator": "磊哥",
    "subTasks": [...],
    "comments": [...],
    "stateHistory": [...]
  }
}
```

---

### 3. 获取任务统计
```http
GET http://192.168.31.187:3000/api/sync/tasks/stats
```

**响应示例：**
```json
{
  "success": true,
  "source": "BCE",
  "syncedAt": "2026-03-20T05:49:06.493Z",
  "data": {
    "total": 10,
    "byStatus": {
      "pending": 2,
      "assigned": 3,
      "executing": 2,
      "reviewing": 1,
      "accepted": 2
    },
    "byPriority": {
      "P0": 3,
      "P1": 5,
      "P2": 2
    }
  }
}
```

---

### 4. 健康检查
```http
GET http://192.168.31.187:3000/api/sync/health
```

**响应示例：**
```json
{
  "success": true,
  "bceConnected": true,
  "syncedAt": "2026-03-20T05:49:06.493Z"
}
```

---

## 📋 Control Center 集成步骤

### 步骤 1：添加 BCE 数据源

在 Control Center 的任务管理页面中，添加 BCE 数据源配置：

```javascript
// Control Center 前端代码示例
const BCE_API_BASE = 'http://192.168.31.187:3000/api/sync';

async function loadTasks() {
  const response = await fetch(`${BCE_API_BASE}/tasks`);
  const result = await response.json();
  
  if (result.success) {
    // 显示 BCE 任务数据
    renderTasks(result.data);
  }
}
```

### 步骤 2：定时刷新数据

每 30 秒自动刷新一次任务数据：

```javascript
// 定时刷新
setInterval(() => {
  loadTasks();
  loadStats();
}, 30000);
```

### 步骤 3：显示同步状态

在页面角落显示数据同步状态：

```
📊 数据源：BCE | 最后同步：13:49:06 | ✅ 正常
```

---

## 🔒 数据一致性保证

### 原则
1. **BCE 是唯一数据源** - 所有任务数据以 BCE 为准
2. **Control Center 只读展示** - 不修改任务数据
3. **实时同步** - 定时刷新确保数据一致

### 同步策略
| 场景 | 同步方式 | 频率 |
|------|---------|------|
| 任务列表 | 定时轮询 | 30 秒 |
| 任务详情 | 按需加载 | 打开时 |
| 任务统计 | 定时轮询 | 30 秒 |
| 健康检查 | 定时轮询 | 60 秒 |

---

## 🎯 访问地址

| 系统 | 地址 | 用途 |
|------|------|------|
| **Control Center** | `http://192.168.31.187:4310` | 系统监控 + 任务展示 |
| **BCE 任务管理** | `http://192.168.31.187:3000/bce-tasks.html` | 任务创建/管理 |
| **同步 API** | `http://192.168.31.187:3000/api/sync` | 数据同步接口 |

---

## ✅ 验收标准

- [x] BCE 提供任务数据 API
- [x] Control Center 可访问 BCE API
- [ ] Control Center 显示 BCE 任务数据
- [ ] 数据实时更新（30 秒刷新）
- [ ] 同步状态显示正常

---

## 📞 技术支持

配置问题联系：匠心 (CTO)
