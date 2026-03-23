#!/bin/bash
# BCE 服务健康检查脚本
# 功能：每 5 分钟检查 BCE 服务状态，挂了自动重启

BCE_URL="http://localhost:3000/health"
BCE_DIR="/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project"
LOG_FILE="$BCE_DIR/runtime/health-check.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_health() {
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BCE_URL" 2>/dev/null)
  
  if [ "$response" = "200" ]; then
    log "✅ BCE 服务正常 (HTTP $response)"
    return 0
  else
    log "🔴 BCE 服务异常 (HTTP $response)，尝试重启..."
    return 1
  fi
}

restart_bce() {
  # 杀死旧进程
  pkill -f "node.*src/index.js" 2>/dev/null
  sleep 2
  
  # 启动新进程
  cd "$BCE_DIR"
  nohup node src/index.js > runtime/server.log 2>&1 &
  
  sleep 5
  
  # 验证启动
  if check_health; then
    log "✅ BCE 服务重启成功"
  else
    log "❌ BCE 服务重启失败，需要人工介入！"
    # 这里可以添加飞书通知
  fi
}

# 主循环
log "========== 健康检查启动 =========="

while true; do
  if ! check_health; then
    restart_bce
  fi
  sleep 300  # 每 5 分钟检查一次
done
