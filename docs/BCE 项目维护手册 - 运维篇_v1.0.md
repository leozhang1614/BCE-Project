# BCE 项目维护手册 - 运维篇

**版本：** v1.0  
**创建日期：** 2026-03-23  
**维护人：** 匠心 (CTO) / 磐石 (SRE)  
**状态：** ✅ 已发布

---

## 📋 目录

1. [服务部署](#服务部署)
2. [PM2 进程守护](#pm2 进程守护)
3. [健康检查](#健康检查)
4. [日志管理](#日志管理)
5. [故障排查](#故障排查)
6. [备份恢复](#备份恢复)

---

## 服务部署

### 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | 18.x+ | 必需 |
| npm | 9.x+ | 必需 |
| PM2 | latest | 进程守护 |
| macOS | 10.15+ | 或 Linux |

### 安装步骤

```bash
# 1. 克隆项目
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库
git clone https://github.com/leozhang1614/BCE-Project.git

# 2. 安装依赖
cd BCE-Project
npm install

# 3. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 4. 安装 PM2
npm install -g pm2

# 5. 启动服务
pm2 start src/index.js --name "bce-server"

# 6. 保存 PM2 配置
pm2 save

# 7. 配置开机自启
pm2 startup
```

---

## PM2 进程守护

### 启动服务

```bash
# 启动 BCE 服务
pm2 start src/index.js --name "bce-server"

# 指定 Node 版本
pm2 start src/index.js --name "bce-server" --interpreter node@18

# 集群模式（多实例）
pm2 start src/index.js --name "bce-server" -i 4
```

### 查看状态

```bash
# 查看所有进程
pm2 status

# 查看详细信息
pm2 show bce-server

# 实时监控
pm2 monit
```

### 重启服务

```bash
# 重启服务
pm2 restart bce-server

# 重启并重新加载配置
pm2 reload bce-server

# 停止服务
pm2 stop bce-server

# 删除服务
pm2 delete bce-server
```

### 查看日志

```bash
# 查看所有日志
pm2 logs

# 查看指定服务日志
pm2 logs bce-server

# 清空日志
pm2 flush
```

### 保存配置

```bash
# 保存当前进程列表
pm2 save

# 恢复进程列表
pm2 resurrect

# 配置开机自启
pm2 startup
# 执行输出的命令
```

---

## 健康检查

### 健康检查脚本

**位置：** `scripts/health-check.sh`

**功能：**
- ✅ 每 5 分钟检查 BCE 服务状态
- ✅ 服务异常自动重启
- ✅ 记录日志

**启动健康检查：**

```bash
# 后台运行
nohup /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/scripts/health-check.sh &

# 查看日志
tail -f /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/runtime/health-check.log
```

### API 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/health

# 预期响应
{
  "status": "ok",
  "service": "BCE v3.4 进度管理增强版",
  "version": "3.4.0"
}
```

---

## 日志管理

### 日志位置

| 日志类型 | 路径 | 说明 |
|----------|------|------|
| PM2 日志 | `~/.pm2/logs/` | PM2 管理的日志 |
| BCE 日志 | `runtime/server.log` | BCE 服务日志 |
| 健康检查 | `runtime/health-check.log` | 健康检查日志 |
| 调度器 | `runtime/scheduler-v3.4.log` | v3.4 调度器日志 |

### 日志轮转

**PM2 自动轮转：**

```bash
# 配置日志轮转（PM2 自动处理）
pm2 install pm2-logrotate

# 设置最大文件大小
pm2 set pm2-logrotate:max_size 10M

# 设置保留文件数
pm2 set pm2-logrotate:retain 7
```

### 日志分析

```bash
# 查看错误日志
grep "ERROR" ~/.pm2/logs/bce-server-error.log

# 查看最近 100 行
tail -100 ~/.pm2/logs/bce-server-out.log

# 实时查看日志
tail -f ~/.pm2/logs/bce-server-out.log
```

---

## 故障排查

### 服务无法启动

**症状：** `pm2 start` 失败

**排查步骤：**

```bash
# 1. 检查 Node.js 版本
node -v

# 2. 检查依赖
npm install

# 3. 查看错误日志
pm2 logs bce-server --err

# 4. 检查端口占用
lsof -i :3000

# 5. 手动启动测试
node src/index.js
```

**解决方案：**

```bash
# 端口被占用
kill -9 $(lsof -t -i:3000)
pm2 restart bce-server

# 依赖缺失
npm install
pm2 restart bce-server
```

---

### 服务频繁崩溃

**症状：** PM2 显示重启次数多

**排查步骤：**

```bash
# 1. 查看重启次数
pm2 show bce-server

# 2. 查看错误日志
pm2 logs bce-server --err --lines 100

# 3. 检查内存使用
pm2 monit
```

**解决方案：**

```bash
# 内存不足，增加 Node 内存限制
pm2 restart bce-server --max-memory-restart 500M

# 代码问题，修复后重启
pm2 restart bce-server
```

---

### API 响应慢

**症状：** 健康检查超时

**排查步骤：**

```bash
# 1. 检查 CPU 使用
pm2 monit

# 2. 检查数据库
ls -lh runtime/bce-data.json

# 3. 检查日志
tail -100 runtime/server.log
```

**解决方案：**

```bash
# 数据库过大，清理历史数据
# 重启服务
pm2 restart bce-server
```

---

## 备份恢复

### 数据备份

```bash
# 备份数据文件
cp runtime/bce-data.json runtime/bce-data.json.backup.$(date +%Y%m%d)

# 备份配置
cp .env .env.backup.$(date +%Y%m%d)

# 备份日志（可选）
tar -czf logs-backup-$(date +%Y%m%d).tar.gz runtime/*.log
```

### 数据恢复

```bash
# 恢复数据文件
cp runtime/bce-data.json.backup.20260323 runtime/bce-data.json

# 恢复配置
cp .env.backup.20260323 .env

# 重启服务
pm2 restart bce-server
```

### 自动备份脚本

```bash
#!/bin/bash
# 每日凌晨 2 点自动备份
BACKUP_DIR="/Users/ai/.openclaw/backups/bce"
mkdir -p "$BACKUP_DIR"

cp /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/runtime/bce-data.json \
   "$BACKUP_DIR/bce-data-$(date +%Y%m%d).json"

# 保留 30 天备份
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete
```

---

## 监控告警

### PM2 监控

```bash
# 实时监控
pm2 monit

# Web 界面
pm2 plus
```

### 自定义监控

**监控脚本：**

```bash
#!/bin/bash
# BCE 服务监控

# 检查服务状态
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ "$response" != "200" ]; then
  echo "🔴 BCE 服务异常 (HTTP $response)"
  # 发送飞书通知
  # 重启服务
  pm2 restart bce-server
fi
```

---

## 性能优化

### Node.js 优化

```bash
# 增加 Node 内存限制
pm2 restart bce-server --max-memory-restart 500M

# 启用集群模式
pm2 restart bce-server -i 4
```

### 数据库优化

```bash
# 定期清理历史数据
# 使用 PostgreSQL 替代 SQLite（大数据量时）
```

---

## 版本升级

### 升级步骤

```bash
# 1. 备份数据
cp runtime/bce-data.json runtime/bce-data.json.backup

# 2. 拉取最新代码
git pull origin master

# 3. 安装依赖
npm install

# 4. 重启服务
pm2 restart bce-server

# 5. 验证服务
curl http://localhost:3000/health
```

---

**文档版本：** v1.0  
**创建日期：** 2026-03-23  
**维护人：** 匠心 (CTO) / 磐石 (SRE)  
**GitHub 仓库：** https://github.com/leozhang1614/BCE-Project
