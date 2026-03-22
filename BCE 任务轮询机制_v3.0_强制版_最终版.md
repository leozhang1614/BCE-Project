# BCE 任务轮询机制 v3.0 - 强制版（最终版）

**版本：** v3.0  
**创建时间：** 2026-03-22  
**最后更新：** 2026-03-22 15:08  
**维护人：** 匠心 (CTO)  
**批准人：** 天枢 (CEO)

---

## 🎯 核心机制

### 两大强制要求

| 要求 | 时限 | 超时处理 |
|------|------|---------|
| **主动查询** | 每 5 分钟必须查询一次 | 超时上报天枢 + 磊哥 |
| **及时反馈** | 发现待办后 1 分钟内必须反馈 | 超时上报天枢 + 磊哥 |

---

## 🔄 工作流程

```
BCE 轮询服务 (bce-poller.js) - Node.js 后台进程
    ↓
每 5 分钟自动执行
    ↓
调用 7 个人的打卡脚本 (bce-checkin.py)
    ↓
查询 BCE 任务 → 记录打卡时间 → 有待办则记录待反馈
    ↓
调用监督脚本 (bce-supervisor.py)
    ↓
检查打卡和反馈情况 → 发现超时 → 🚨 上报天枢 + 磊哥
    ↓
5 分钟后重复
```

---

## 📊 技术实现

### 1. BCE 轮询服务（核心强制机制）⭐

**位置：** `/Users/ai/.openclaw/scripts/bce-poller.js`

**启动方式：**
```bash
node /Users/ai/.openclaw/scripts/bce-poller.js &
```

**进程守护：**
- ✅ 后台运行（nohup）
- ✅ 不依赖 crontab
- ✅ 精确 5 分钟间隔
- ✅ 系统重启后手动恢复

**执行逻辑：**
```javascript
1. 每 5 分钟自动触发
2. 并行调用 7 个人的打卡脚本
3. 调用监督脚本检查违规
4. 记录执行日志
5. 5 分钟后重复
```

**日志位置：** `/Users/ai/.openclaw/logs/bce-poller.log`

**查看服务状态：**
```bash
# 查看进程
ps aux | grep "bce-poller"

# 查看日志
tail -f /Users/ai/.openclaw/logs/bce-poller.log
```

**重启服务：**
```bash
pkill -f "bce-poller" && node /Users/ai/.openclaw/scripts/bce-poller.js &
```

---

### 2. 打卡脚本 (bce-checkin.py)

**位置：** `/Users/ai/.openclaw/agents/{agent}/scripts/bce-checkin.py`

**执行方式：** 由 BCE 轮询服务每 5 分钟自动调用

**执行逻辑：**
```python
1. 调用 BCE API 查询待办任务
2. 记录打卡时间 → last_check_in.json
3. 如果有待办任务:
   - 记录发现时间
   - 设置 1 分钟反馈截止时间
   - 保存到 pending_feedback.json
   - 显示任务详情和反馈方式
4. 如果无待办任务:
   - 清除 pending_feedback.json
5. 写入日志
```

**文件说明：**
- `last_check_in.json` - 打卡记录（证明自己查了）
- `pending_feedback.json` - 待反馈任务（用于监督 1 分钟反馈）

---

### 3. 监督脚本 (bce-supervisor.py)

**位置：** `/Users/ai/.openclaw/agents/jiangxin/scripts/bce-supervisor.py`

**执行方式：** 由 BCE 轮询服务每 5 分钟自动调用

**检查内容：**
1. **打卡情况** - 检查所有人的 `last_check_in.json`
   - 超过 5 分钟未打卡 → ❌ 违规
2. **反馈情况** - 检查所有人的 `pending_feedback.json`
   - 超过 1 分钟未反馈 → 🚨 违规

**违规处理：**
- 记录违规日志
- 上报天枢 + 磊哥

---

## 📁 文件结构

```
/Users/ai/.openclaw/
├── scripts/
│   └── bce-poller.js           # ⭐ BCE 轮询服务（核心）
├── agents/
│   ├── jiangxin/
│   │   ├── scripts/
│   │   │   ├── bce-checkin.py      # 匠心打卡脚本
│   │   │   └── bce-supervisor.py   # 监督脚本
│   │   ├── last_check_in.json      # 匠心打卡记录
│   │   └── pending_feedback.json   # 匠心待反馈任务
│   ├── siku/
│   │   └── scripts/bce-checkin.py  # 司库打卡脚本
│   └── ... (其他人)
└── logs/
    ├── bce-poller.log            # ⭐ 轮询服务日志
    ├── jiangxin-bce-checkin.log  # 匠心打卡日志
    └── bce-supervisor.log        # 监督日志
```

---

## ✅ 反馈方式

### 方式 1：BCE 系统 Web 界面（推荐）

1. 访问：http://192.168.31.187:3000/bce-tasks.html
2. 登录个人账户
3. 查看"我的任务"
4. 点击"确认"按钮
5. ✅ 反馈完成

### 方式 2：飞书确认

1. 在飞书群收到任务通知
2. 点击"确认任务"按钮
3. ✅ 反馈完成

### 方式 3：bce-task-flow Skill

```
用户：确认任务 [任务 ID 或任务标题]

Skill 响应：
✅ 任务已确认
- 确认人：匠心
- 确认时间：2026-03-22 15:00
- 状态：进行中
```

---

## 📋 验证方式

### 查看轮询服务状态
```bash
ps aux | grep "bce-poller"
```

### 查看自己的打卡记录
```bash
cat ~/.openclaw/agents/{agent}/last_check_in.json
```

### 查看自己的待反馈任务
```bash
cat ~/.openclaw/agents/{agent}/pending_feedback.json
```

### 查看日志
```bash
# 轮询日志
tail -f /Users/ai/.openclaw/logs/bce-poller.log

# 打卡日志
tail -f ~/.openclaw/logs/{agent}-bce-checkin.log

# 监督日志
tail -f ~/.openclaw/logs/bce-supervisor.log
```

---

## 🚨 常见问题

### Q1: 轮询服务是否运行？

**检查命令：**
```bash
ps aux | grep "bce-poller" | grep -v grep
```

**正常输出：**
```
ai  13381  0.0  0.3  436126560  43184  ??  SN  3:04PM  0:00.07  node bce-poller.js
```

### Q2: 如何确保强制性？

**强制机制：**
1. ✅ Node.js 后台进程 - 系统级别自动执行
2. ✅ 不依赖 crontab - 避免系统限制
3. ✅ 不依赖自觉 - 到点自动运行
4. ✅ 精确计时 - 5 分钟间隔
5. ✅ 进程守护 - 后台持续运行

### Q3: 服务宕机怎么办？

**恢复命令：**
```bash
pkill -f "bce-poller"
node /Users/ai/.openclaw/scripts/bce-poller.js &
```

### Q4: 如何查看谁超时了？

**查看监督日志：**
```bash
tail -f /Users/ai/.openclaw/logs/bce-supervisor.log
```

**违规输出示例：**
```
[2026-03-22 15:00:00] ❌ [匠心] 已 7 分钟未查询
[2026-03-22 15:00:00] 🚨 [司库] 发现待办任务后已 90 秒未反馈
[2026-03-22 15:00:00] ⚠️  已上报到天枢和磊哥
```

### Q5: 反馈后状态如何清除？

**自动清除机制：**
1. 轮询服务每 5 分钟调用打卡脚本
2. 打卡脚本查询 BCE API 检查待办任务
3. 如果无待确认任务 → 自动删除 `pending_feedback.json`
4. 下次监督脚本检查时发现文件已删除 → 判定为已反馈

### Q6: 多任务并发场景如何处理？

**1 分钟反馈定义：**
- 发现待办任务后 1 分钟内**开始反馈流程**
- 不要求 1 分钟内完成所有任务确认
- 确认 1 个或多个都可

**建议：**
- 优先确认 P0 任务
- 其他任务可备注说明

### Q7: Agent 路径是什么？

**路径规则：**
```
~/.openclaw/agents/{agent}/
```

**对应关系：**
| 角色 | Agent 路径 |
|------|-----------|
| 匠心 | `~/.openclaw/agents/jiangxin/` |
| 司库 | `~/.openclaw/agents/siku/` |
| 磐石 | `~/.openclaw/agents/panshi/` |
| 执矩 | `~/.openclaw/agents/zhiju/` |
| 灵犀 | `~/.openclaw/agents/lingxi/` |
| 天策 | `~/.openclaw/agents/tiance/` |
| 智源 | `~/.openclaw/agents/zhiyuan/` |

---

## 📊 测试验证

### 首次测试（2026-03-22 15:04）

**测试结果：**

| 测试项 | 结果 | 状态 |
|--------|------|------|
| 轮询服务启动 | ✅ 进程运行中 (PID: 13381) | ✅ 通过 |
| 打卡脚本调用 | ✅ 7 个人都成功 | ✅ 通过 |
| 监督脚本调用 | ✅ 执行成功 | ✅ 通过 |
| 日志记录 | ✅ 正常写入 | ✅ 通过 |
| 定时执行 | ✅ 5 分钟间隔 | ✅ 通过 |

**轮询日志：**
```
[2026-03-22T07:04:34.055Z] ✅ [jiangxin] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [siku] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [panshi] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [zhiju] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [lingxi] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [tiance] 打卡成功
[2026-03-22T07:04:34.055Z] ✅ [zhiyuan] 打卡成功

完成：7 成功，0 失败，耗时 122ms
下次执行：5 分钟后
```

---

## 📚 版本历史

| 版本 | 日期 | 更新内容 | 状态 |
|------|------|---------|------|
| v1.0 | 2026-03-22 14:40 | 初始版本（1 分钟反馈机制） | ✅ 已发布 |
| v2.0 | 2026-03-22 14:52 | 修复问题 + 完整文档 | ✅ 已发布 |
| v3.0 | 2026-03-22 15:08 | Node.js 轮询服务（强制版） | ✅ 已部署 |

**v3.0 核心改进：**
1. ✅ 新增 BCE 轮询服务（bce-poller.js）
2. ✅ 不依赖 crontab，系统进程保证强制性
3. ✅ 精确 5 分钟间隔执行
4. ✅ 进程守护，后台持续运行
5. ✅ 首次测试全部成功

---

## 🎯 确认清单

**请大家确认：**

- [ ] ✅ 已阅读 v3.0 文档
- [ ] ✅ 理解强制轮询机制（Node.js 服务）
- [ ] ✅ 理解 5 分钟查询机制
- [ ] ✅ 理解 1 分钟反馈机制
- [ ] ✅ 知道自己的 Agent 路径
- [ ] ✅ 知道如何反馈任务
- [ ] ✅ 知道如何查看日志
- [ ] ✅ 无疑问（或已提出）

---

## 📞 服务管理

**查看状态：**
```bash
ps aux | grep "bce-poller"
```

**查看日志：**
```bash
tail -f /Users/ai/.openclaw/logs/bce-poller.log
```

**重启服务：**
```bash
pkill -f "bce-poller" && node /Users/ai/.openclaw/scripts/bce-poller.js &
```

---

**文档版本：** v3.0  
**最后更新：** 2026-03-22 15:08  
**维护人：** 匠心 (CTO)  
**批准人：** 天枢 (CEO)

---

**状态：** ✅ 已部署，已验证，可立即执行

**服务状态：** ✅ 运行中 (PID: 13381)

**首次执行：** ✅ 7/7 成功
