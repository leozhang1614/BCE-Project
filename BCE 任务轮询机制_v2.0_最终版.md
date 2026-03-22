# BCE 任务轮询机制 v2.0 - 最终版

**版本：** v2.0  
**创建时间：** 2026-03-22  
**最后更新：** 2026-03-22 14:52  
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
每 5 分钟 → 打卡脚本自动运行
    ↓
查询 BCE 任务（GET /api/bce/tasks?assignee={名字}）
    ↓
┌─────────────────┬─────────────────┐
│  有待办任务     │  无待办任务     │
├─────────────────┼─────────────────┤
│ 记录发现时间    │  打卡完成       │
│ 设置 1 分钟截止时间│  清除待反馈文件 │
│ 保存待反馈任务   │                 │
└─────────────────┴─────────────────┘
    ↓
监督脚本检查（每 5 分钟）
    ↓
发现超时 → 🚨 上报天枢 + 磊哥
```

---

## 📊 技术实现

### 1. 打卡脚本 (bce-checkin.py)

**位置：** `/Users/ai/.openclaw/agents/{agent}/scripts/bce-checkin.py`

**定时任务：**
```bash
*/5 * * * * python3 /Users/ai/.openclaw/agents/{agent}/scripts/bce-checkin.py
```

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

### 2. 监督脚本 (bce-supervisor.py)

**位置：** `/Users/ai/.openclaw/agents/jiangxin/scripts/bce-supervisor.py`

**定时任务：**
```bash
*/5 * * * * python3 /Users/ai/.openclaw/agents/jiangxin/scripts/bce-supervisor.py
```

**检查内容：**
1. **打卡情况** - 检查所有人的 `last_check_in.json`
   - 超过 5 分钟未打卡 → ❌ 违规
2. **反馈情况** - 检查所有人的 `pending_feedback.json`
   - 超过 1 分钟未反馈 → 🚨 违规

**违规处理：**
- 记录违规日志
- 上报天枢 + 磊哥

---

### 3. 定时任务配置

**配置方式：**
```bash
bash /Users/ai/.openclaw/scripts/configure-bce-cron.sh
```

**定时任务列表：**
```bash
# BCE 打卡任务 - 7 个人（每 5 分钟）
*/5 * * * * python3 /Users/ai/.openclaw/agents/jiangxin/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/siku/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/panshi/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/zhiju/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/lingxi/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/tiance/scripts/bce-checkin.py
*/5 * * * * python3 /Users/ai/.openclaw/agents/zhiyuan/scripts/bce-checkin.py

# BCE 监督任务 - 1 个（每 5 分钟）
*/5 * * * * python3 /Users/ai/.openclaw/agents/jiangxin/scripts/bce-supervisor.py
```

---

## 📁 文件结构

```
/Users/ai/.openclaw/
├── agents/
│   ├── jiangxin/
│   │   ├── scripts/
│   │   │   ├── bce-checkin.py      # 匠心打卡脚本
│   │   │   └── bce-supervisor.py   # 监督脚本（只有匠心有）
│   │   ├── last_check_in.json      # 匠心打卡记录
│   │   └── pending_feedback.json   # 匠心待反馈任务
│   ├── siku/
│   │   └── scripts/bce-checkin.py  # 司库打卡脚本
│   ├── panshi/
│   │   └── scripts/bce-checkin.py  # 磐石打卡脚本
│   └── ... (其他人)
├── scripts/
│   └── configure-bce-cron.sh       # 定时任务配置脚本
└── logs/
    ├── jiangxin-bce-checkin.log    # 匠心打卡日志
    ├── siku-bce-checkin.log        # 司库打卡日志
    └── bce-supervisor.log          # 监督日志
```

---

## ✅ 反馈方式

### 方式 1：BCE 系统 Web 界面（推荐）

1. 访问：http://192.168.31.187:3000/bce-tasks.html
2. 登录个人账户
3. 查看"我的任务"
4. 点击"确认"按钮
5. ✅ 反馈完成（pending_feedback.json 自动清除）

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
- 确认时间：2026-03-22 14:50
- 状态：进行中
```

---

## 📋 验证方式

### 查看自己的打卡记录
```bash
cat ~/.openclaw/agents/{agent}/last_check_in.json
```

### 查看自己的待反馈任务
```bash
cat ~/.openclaw/agents/{agent}/pending_feedback.json
```

### 查看打卡日志
```bash
tail -f ~/.openclaw/logs/{agent}-bce-checkin.log
```

### 查看监督日志
```bash
tail -f ~/.openclaw/logs/bce-supervisor.log
```

### 手动检查反馈状态
```bash
python3 ~/.openclaw/agents/jiangxin/scripts/bce-supervisor.py
```

### 验证定时任务
```bash
crontab -l | grep bce
```

---

## 🚨 常见问题

### Q1: 脚本是否已部署？

**检查命令：**
```bash
ls -la ~/.openclaw/agents/{agent}/scripts/bce-checkin.py
```

**状态：**
- ✅ 7 个人的打卡脚本都已部署
- ✅ 监督脚本已部署（匠心）
- ✅ 定时任务已配置

### Q2: 如何确认我的 Agent 路径？

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

### Q3: 反馈后状态如何清除？

**自动清除机制：**
1. 打卡脚本每 5 分钟运行
2. 查询 BCE API 检查待办任务
3. 如果无待确认任务 → 自动删除 `pending_feedback.json`
4. 下次监督脚本检查时发现文件已删除 → 判定为已反馈

### Q4: 宕机/离线场景如何处理？

**当前机制：**
- 依赖 cron 保证脚本执行
- 系统重启后 cron 自动恢复

**建议优化（后续）：**
- 增加进程健康检查
- 宕机时通知天枢

### Q5: 多任务并发场景如何处理？

**1 分钟反馈定义：**
- 发现待办任务后 1 分钟内**开始反馈流程**
- 不要求 1 分钟内完成所有任务确认
- 确认 1 个或多个都可

**建议：**
- 优先确认 P0 任务
- 其他任务可备注说明

### Q6: 时间同步问题？

**当前状态：**
- ✅ 所有 Agent 在同一台机器
- ✅ 使用系统统一时间
- ✅ 无时区/时钟偏差问题

### Q7: 文件依赖风险？

**风险：** `pending_feedback.json` 被误删会重置计时

**缓解措施：**
1. 打卡脚本有日志记录
2. 监督脚本有日志记录
3. 可通过日志追溯

---

## 📊 测试验证

### 首次测试（2026-03-22 14:51）

**测试结果：**

| 测试项 | 结果 | 状态 |
|--------|------|------|
| 打卡脚本部署 | ✅ 7 个人都有 | ✅ 通过 |
| 监督脚本部署 | ✅ 匠心已部署 | ✅ 通过 |
| 打卡记录生成 | ✅ last_check_in.json 正常 | ✅ 通过 |
| 待反馈任务记录 | ✅ pending_feedback.json 正常 | ✅ 通过 |
| 监督脚本检查 | ✅ 能检测超时 | ✅ 通过 |
| 定时任务配置 | ✅ crontab 已配置 | ✅ 通过 |

**监督日志：**
```
[2026-03-22 14:51:56] BCE 任务查询监督 - 开始检查
[2026-03-22 14:51:56] ✅ [匠心] 0 分钟前已查询
[2026-03-22 14:51:56] ❌ [司库] 已 13 分钟未查询
[2026-03-22 14:51:56] ❌ [磐石] 已 13 分钟未查询
...
[2026-03-22 14:51:56] ⚠️  已上报到天枢和磊哥
```

---

## 📚 更新日志

| 版本 | 日期 | 更新内容 | 批准人 |
|------|------|---------|--------|
| v1.0 | 2026-03-22 14:40 | 初始版本（1 分钟反馈机制） | 天枢 |
| v2.0 | 2026-03-22 14:52 | 修复问题 + 完整文档 | 天枢 |

**v2.0 更新内容：**
1. ✅ 添加定时任务配置脚本
2. ✅ 明确文件结构和路径
3. ✅ 补充常见问题解答
4. ✅ 添加测试验证结果
5. ✅ 明确反馈清除机制
6. ✅ 明确多任务并发处理

---

## 🎯 确认清单

**请大家确认：**

- [ ] ✅ 已阅读 v2.0 文档
- [ ] ✅ 理解 5 分钟查询机制
- [ ] ✅ 理解 1 分钟反馈机制
- [ ] ✅ 知道自己的 Agent 路径
- [ ] ✅ 知道如何反馈任务
- [ ] ✅ 知道如何验证状态
- [ ] ✅ 有疑问已提出

---

**文档版本：** v2.0  
**最后更新：** 2026-03-22 14:52  
**维护人：** 匠心 (CTO)  
**批准人：** 天枢 (CEO)
