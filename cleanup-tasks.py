#!/usr/bin/env python3
"""
清理 OCC 未完成任务脚本
保留：已完成任务、定时任务
删除：其他未完成任务
"""

import requests
import json

OCC_BASE_URL = "http://192.168.31.187:4310"

def get_all_tasks():
    """获取所有任务"""
    resp = requests.get(f"{OCC_BASE_URL}/api/tasks", timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get('tasks', [])

def is_recurring_task(task):
    """判断是否是定时任务"""
    title = task.get('title', '').lower()
    desc = task.get('description', '').lower()
    
    # 定时任务关键词
    recurring_keywords = ['定时', '周期', '每日', '每周', '每月', 'cron', 'daily', 'weekly', 'monthly', 'heartbeat']
    
    for keyword in recurring_keywords:
        if keyword in title or keyword in desc:
            return True
    
    return False

def delete_task(task_id):
    """删除任务"""
    try:
        # OCC API 删除任务的端点（需要确认实际端点）
        resp = requests.delete(f"{OCC_BASE_URL}/api/tasks/{task_id}", timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print(f"删除失败：{task_id} - {e}")
        return False

def main():
    print("=== OCC 任务清理脚本 ===\n")
    
    # 获取所有任务
    print("获取任务列表...")
    tasks = get_all_tasks()
    print(f"总任务数：{len(tasks)}\n")
    
    # 分类
    keep_tasks = []  # 保留
    delete_tasks = []  # 删除
    
    for task in tasks:
        task_id = task.get('taskId')
        title = task.get('title')
        status = task.get('status')
        owner = task.get('owner')
        
        # 已完成 - 保留
        if status == 'done':
            keep_tasks.append(task)
            print(f"✅ 保留 [已完成]: {title}")
            continue
        
        # 定时任务 - 保留
        if is_recurring_task(task):
            keep_tasks.append(task)
            print(f"✅ 保留 [定时任务]: {title}")
            continue
        
        # 其他未完成任务 - 删除
        delete_tasks.append(task)
        print(f"❌ 删除 [未完成]: {title}")
    
    print(f"\n=== 汇总 ===")
    print(f"保留：{len(keep_tasks)} 个")
    print(f"删除：{len(delete_tasks)} 个")
    
    # 确认删除
    if len(delete_tasks) == 0:
        print("\n无需删除任务")
        return
    
    confirm = input(f"\n确认删除 {len(delete_tasks)} 个任务？(yes/no): ")
    if confirm.lower() != 'yes':
        print("已取消")
        return
    
    # 执行删除
    print("\n开始删除...")
    deleted = 0
    failed = 0
    
    for task in delete_tasks:
        task_id = task.get('taskId')
        title = task.get('title')
        
        if delete_task(task_id):
            print(f"✅ 已删除：{title}")
            deleted += 1
        else:
            print(f"❌ 删除失败：{title}")
            failed += 1
    
    print(f"\n=== 删除完成 ===")
    print(f"成功：{deleted} 个")
    print(f"失败：{failed} 个")

if __name__ == '__main__':
    main()
