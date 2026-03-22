#!/bin/bash

# BCE v3.2 培训任务列表
declare -a ASSIGNEES=("天枢" "匠心" "司库" "执矩" "磐石" "灵犀" "天策")

for assignee in "${ASSIGNEES[@]}"; do
  echo "创建任务：$assignee"
  
  curl -X POST http://localhost:3000/api/bce/tasks \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"📚 BCE v3.2 系统培训 - $assignee\",
      \"description\": \"学习 BCE v3.2 系统使用，掌握任务创建、分配、确认、流转全流程。培训内容包括：1.系统概述 2.使用要求 3.面板操作 4.实操练习\",
      \"creator\": \"匠心\",
      \"assignee\": \"$assignee\",
      \"priority\": \"P0\",
      \"dueDate\": \"2026-03-22T18:00:00Z\"
    }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"✅ {d.get('taskId', 'N/A')}: {d.get('data',{}).get('title', 'N/A')}\")"
  
  sleep 1
done

echo -e "\n=== 所有培训任务创建完成 ==="
