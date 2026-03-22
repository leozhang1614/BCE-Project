#!/usr/bin/env python3
import requests
import json

OCC_BASE = "http://192.168.31.187:4310"

# 获取所有任务
resp = requests.get(f"{OCC_BASE}/api/tasks", timeout=10)
tasks = resp.json().get('tasks', [])

# 定时任务关键词
recurring_keywords = ['定时', '周期', '每日', '每周', '每月', 'cron', 'daily', 'weekly', 'heartbeat', '心跳']

# 筛选待删除任务
to_delete = []
for task in tasks:
    status = task.get('status')
    title = task.get('title', '')
    desc = task.get('description', '')
    
    # 已完成 - 跳过
    if status == 'done':
        continue
    
    # 定时任务 - 跳过
    is_recurring = any(kw in title.lower() or kw in desc.lower() for kw in recurring_keywords)
    if is_recurring:
        print(f"✅ 保留 [定时]: {title}")
        continue
    
    # 其他未完成任务 - 加入删除列表
    to_delete.append({
        'taskId': task.get('taskId'),
        'title': title,
        'owner': task.get('owner')
    })

print(f"\n=== 待删除任务：{len(to_delete)} 个 ===\n")

# 执行删除
deleted = 0
for task in to_delete:
    task_id = task['taskId']
    title = task['title']
    
    try:
        resp = requests.delete(f"{OCC_BASE}/api/boards/main/tasks/{task_id}", timeout=5)
        if resp.status_code in [200, 204]:
            print(f"✅ 已删除：{title}")
            deleted += 1
        else:
            print(f"❌ 删除失败 ({resp.status_code}): {title}")
    except Exception as e:
        print(f"❌ 异常：{title} - {e}")

print(f"\n=== 删除完成：{deleted}/{len(to_delete)} ===")
