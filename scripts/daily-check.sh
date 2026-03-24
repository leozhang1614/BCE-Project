#!/bin/bash
# BCE 服务日常检查脚本
# 使用：./daily-check.sh

echo "=== BCE 服务健康检查 ==="
echo "时间：$(date)"
echo ""

# 检查 BCE 服务
echo "1. BCE 服务状态："
pm2 list | grep bce-server

# 检查心跳任务
echo ""
echo "2. 心跳任务状态："
ps aux | grep heartbeat-worker | grep -v grep || echo "❌ 心跳任务未运行"

# 检查健康接口
echo ""
echo "3. 健康检查："
curl -s http://localhost:3000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ 状态:', d.get('status'))" 2>/dev/null || echo "❌ 健康检查失败"

# 检查磁盘空间
echo ""
echo "4. 磁盘空间："
df -h /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project | tail -1

# 检查最近错误
echo ""
echo "5. 最近错误（最近 10 条）："
tail -10 /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/logs/pm2-error.log 2>/dev/null || echo "无错误日志"

echo ""
echo "=== 检查完成 ==="
