#!/usr/bin/env python3
"""
记忆桥接脚本 - Memory Bridge Script
统一记忆管理器 (Unified Memory Manager)

功能：
1. 双写模式：工作区记忆 + 中央 SQLite 数据库
2. 原子事务：确保数据一致性
3. 即时索引：触发向量嵌入更新
4. 重试队列：失败自动恢复

使用示例：
    from memory_bridge import UnifiedMemoryManager
    
    mgr = UnifiedMemoryManager("jiangxin")
    result = mgr.add_memory("完成任务", {"task_id": "001"})
    print(f"记忆已同步：{result}")
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
import logging
import atexit

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MemoryBridge")

class UnifiedMemoryManager:
    """统一记忆管理器 - 双写模式"""
    
    def __init__(self, agent_name: str, workspace_root: str = None, central_db_root: str = None):
        self.agent_name = agent_name
        
        # 默认路径
        if workspace_root is None:
            workspace_root = os.path.expanduser("~/.openclaw")
        if central_db_root is None:
            central_db_root = os.path.join(os.path.expanduser("~"), ".openclaw", "memory")
        
        # 工作区记忆目录
        self.local_memory_dir = Path(workspace_root) / f"workspace-{agent_name}" / "memory"
        self.local_memory_dir.mkdir(parents=True, exist_ok=True)
        
        # 中央数据库路径
        self.central_db_path = Path(central_db_root) / f"{agent_name}.sqlite"
        
        # 重试队列
        self.retry_queue = []
        
        # 初始化数据库
        self._init_central_db()
        
        # 注册退出钩子
        atexit.register(self.flush_pending_memories)
        
        logger.info(f"[{agent_name}] 记忆管理器初始化完成")
    
    def _init_central_db(self):
        """初始化中央 SQLite 数据库"""
        conn = sqlite3.connect(self.central_db_path)
        cursor = conn.cursor()
        
        # 创建记忆表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSON,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                source_file TEXT,
                status TEXT DEFAULT 'synced',
                is_migrated BOOLEAN DEFAULT FALSE,
                embedding_id TEXT
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON memories(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent ON memories(agent_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_status ON memories(status)")
        
        conn.commit()
        conn.close()
        logger.info(f"[{self.agent_name}] 中央数据库初始化完成：{self.central_db_path}")
    
    def add_memory(self, content: str, metadata: dict = None) -> dict:
        """
        统一记忆提交接口（双写模式）
        
        参数:
            content: 记忆内容
            metadata: 元数据（可选）
        
        返回:
            {
                "status": "success",
                "central_id": 123,
                "local_file": "/path/to/file.json",
                "timestamp": "2026-03-19T13:15:00"
            }
        """
        if metadata is None:
            metadata = {}
        
        timestamp = datetime.now().isoformat()
        local_filename = f"memory_{timestamp.replace(':', '-').replace('.', '-')}.json"
        local_filepath = self.local_memory_dir / local_filename
        
        # === 阶段 1: 写入本地工作区 ===
        try:
            local_data = {
                "content": content,
                "metadata": metadata,
                "timestamp": timestamp,
                "agent": self.agent_name
            }
            with open(local_filepath, 'w', encoding='utf-8') as f:
                json.dump(local_data, f, ensure_ascii=False, indent=2)
            logger.info(f"[{self.agent_name}] ✅ 本地记忆写入成功：{local_filename}")
        except Exception as e:
            logger.error(f"[{self.agent_name}] ❌ 本地写入失败：{e}")
            raise RuntimeError(f"Local write failed: {e}")
        
        # === 阶段 2: 同步到中央数据库（事务性） ===
        central_id = None
        try:
            conn = sqlite3.connect(self.central_db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO memories (agent_name, content, metadata, timestamp, source_file, status)
                VALUES (?, ?, ?, ?, ?, 'synced')
            """, (
                self.agent_name,
                content,
                json.dumps(metadata, ensure_ascii=False),
                timestamp,
                str(local_filepath)
            ))
            
            central_id = cursor.lastrowid
            conn.commit()
            conn.close()
            logger.info(f"[{self.agent_name}] ✅ 中央同步成功：ID={central_id}")
        except Exception as e:
            logger.error(f"[{self.agent_name}] ❌ 中央同步失败：{e}")
            # 加入重试队列
            self._queue_for_retry(content, metadata, str(local_filepath))
            raise RuntimeError(f"Central sync failed: {e}")
        
        # === 阶段 3: 触发向量索引更新（可选） ===
        try:
            embedding_id = self._update_embedding_index(content, central_id)
            if embedding_id:
                self._update_embedding_ref(central_id, embedding_id)
        except Exception as e:
            logger.warning(f"[{self.agent_name}] ⚠️ 索引更新失败（非致命）: {e}")
        
        return {
            "status": "success",
            "central_id": central_id,
            "local_file": str(local_filepath),
            "timestamp": timestamp
        }
    
    def _update_embedding_index(self, content: str, record_id: int) -> str:
        """
        调用嵌入模型生成向量并更新索引
        
        注：需要根据实际向量库实现
        """
        # TODO: 集成向量数据库
        # embedding = get_embedding_from_api(content)
        # vector_db.upsert(id=record_id, vector=embedding)
        return f"emb_{record_id}"
    
    def _update_embedding_ref(self, record_id: int, embedding_id: str):
        """更新中央库的 embedding_id 字段"""
        conn = sqlite3.connect(self.central_db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE memories SET embedding_id = ? WHERE id = ?", (embedding_id, record_id))
        conn.commit()
        conn.close()
    
    def _queue_for_retry(self, content, metadata, filepath):
        """将失败的同步任务加入重试队列"""
        self.retry_queue.append({
            "content": content,
            "metadata": metadata,
            "filepath": filepath,
            "timestamp": datetime.now().isoformat(),
            "retry_count": 0
        })
        logger.warning(f"[{self.agent_name}] 任务加入重试队列，当前队列长度：{len(self.retry_queue)}")
    
    def flush_pending_memories(self):
        """会话结束时强制刷新所有待同步数据"""
        if not self.retry_queue:
            return
        
        logger.info(f"[{self.agent_name}] 正在刷新 {len(self.retry_queue)} 条待同步记忆...")
        
        failed = []
        for item in self.retry_queue:
            try:
                # 读取本地文件内容
                with open(item["filepath"], 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 重新尝试同步
                conn = sqlite3.connect(self.central_db_path)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO memories (agent_name, content, metadata, timestamp, source_file, status)
                    VALUES (?, ?, ?, ?, ?, 'retried')
                """, (
                    self.agent_name,
                    data["content"],
                    json.dumps(data["metadata"], ensure_ascii=False),
                    data["timestamp"],
                    item["filepath"]
                ))
                conn.commit()
                conn.close()
                logger.info(f"[{self.agent_name}] ✅ 重试成功：{item['filepath']}")
            except Exception as e:
                logger.error(f"[{self.agent_name}] ❌ 重试失败：{e}")
                item["retry_count"] += 1
                if item["retry_count"] < 3:
                    failed.append(item)
        
        self.retry_queue = failed
        logger.info(f"[{self.agent_name}] 刷新完成，剩余失败任务：{len(self.retry_queue)}")
    
    def get_memories(self, limit: int = 100, offset: int = 0) -> list:
        """获取记忆列表"""
        conn = sqlite3.connect(self.central_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM memories 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def search_memories(self, keyword: str) -> list:
        """搜索记忆（支持关键词）"""
        conn = sqlite3.connect(self.central_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM memories 
            WHERE content LIKE ? OR metadata LIKE ?
            ORDER BY timestamp DESC
        """, (f"%{keyword}%", f"%{keyword}%"))
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]


# ==================== 命令行接口 ====================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("用法：python memory_bridge.py <agent_name> [command] [args...]")
        print("命令:")
        print("  add <content> [metadata_json]  - 添加记忆")
        print("  list [limit]                   - 列出记忆")
        print("  search <keyword>               - 搜索记忆")
        print("  flush                          - 刷新重试队列")
        sys.exit(1)
    
    agent_name = sys.argv[1]
    command = sys.argv[2] if len(sys.argv) > 2 else "list"
    
    mgr = UnifiedMemoryManager(agent_name)
    
    if command == "add":
        if len(sys.argv) < 4:
            print("错误：请提供记忆内容")
            sys.exit(1)
        content = sys.argv[3]
        metadata = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
        result = mgr.add_memory(content, metadata)
        print(f"✅ 记忆已同步：{result}")
    
    elif command == "list":
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        memories = mgr.get_memories(limit=limit)
        print(f"📋 {agent_name} 的最新 {len(memories)} 条记忆:")
        for m in memories:
            print(f"  [{m['id']}] {m['timestamp']} - {m['content'][:50]}...")
    
    elif command == "search":
        if len(sys.argv) < 4:
            print("错误：请提供关键词")
            sys.exit(1)
        keyword = sys.argv[3]
        memories = mgr.search_memories(keyword)
        print(f"🔍 找到 {len(memories)} 条匹配记忆:")
        for m in memories:
            print(f"  [{m['id']}] {m['timestamp']} - {m['content'][:50]}...")
    
    elif command == "flush":
        mgr.flush_pending_memories()
        print("✅ 重试队列已刷新")
    
    else:
        print(f"未知命令：{command}")
        sys.exit(1)
