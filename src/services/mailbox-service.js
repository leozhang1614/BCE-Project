/**
 * 文件系统邮箱服务（ClawTeam 启发）
 * 可靠消息存储，支持离线拉取
 */

const fs = require('fs').promises;
const path = require('path');

class MailboxService {
  constructor() {
    this.mailboxDir = process.env.MAILBOX_DIR || 'runtime/inboxes';
    this.atomicWrite = process.env.MAILBOX_ATOMIC_WRITE === 'true';
    // 中文名 -> 拼音映射
    this.nameMap = {
      '天枢': 'tianshu',
      '匠心': 'jiangxin',
      '司库': 'siku',
      '执矩': 'zhiju',
      '磐石': 'panshi',
      '灵犀': 'lingxi',
      '天策': 'tiance'
    };
  }

  /**
   * 中文名转换为拼音目录名
   */
  toDirName(name) {
    return this.nameMap[name] || name;
  }

  /**
   * 发送消息到邮箱（同时推送 sessions_send）
   */
  async send(to, from, type, content, taskId, sessionKey = null) {
    const agentDir = path.join(this.mailboxDir, to);
    await fs.mkdir(agentDir, { recursive: true });
    
    const msg = {
      id: `msg-${Date.now()}`,
      from,
      to,
      type,
      taskId,
      sessionKey,  // v3.2 新增：预留会话 ID
      content,
      createdAt: new Date().toISOString(),
      read: false
    };
    
    // 原子写入（tmp + rename）
    if (this.atomicWrite) {
      const tmpFile = path.join(agentDir, `.tmp-${msg.id}.json`);
      const msgFile = path.join(agentDir, `${msg.id}.json`);
      
      await fs.writeFile(tmpFile, JSON.stringify(msg, null, 2));
      await fs.rename(tmpFile, msgFile);
    } else {
      const msgFile = path.join(agentDir, `${msg.id}.json`);
      await fs.writeFile(msgFile, JSON.stringify(msg, null, 2));
    }
    
    console.log(`[邮箱] 消息已存入 ${to} 的邮箱：${msg.id}`);
    
    return msg;
  }

  /**
   * 接收消息（获取未读）
   */
  async receive(agent, consume = false) {
    const agentDir = path.join(this.mailboxDir, this.toDirName(agent));
    
    try {
      const files = await fs.readdir(agentDir);
      const msgs = [];
      
      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.tmp')) {
          const content = await fs.readFile(path.join(agentDir, file), 'utf-8');
          const msg = JSON.parse(content);
          
          if (!msg.read) {
            msgs.push(msg);
            
            if (consume) {
              // 移动到已读目录
              const readDir = path.join(agentDir, 'read');
              await fs.mkdir(readDir, { recursive: true });
              await fs.rename(
                path.join(agentDir, file),
                path.join(readDir, file)
              );
            } else {
              // 只标记为已读
              msg.read = true;
              await this.markAsRead(msg.id, agent);
            }
          }
        }
      }
      
      return msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error(`[邮箱] 读取 ${agent} 邮箱失败:`, error.message);
      return [];
    }
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(messageId, agent) {
    const msgFile = path.join(this.mailboxDir, agent, messageId);
    
    try {
      const content = await fs.readFile(msgFile, 'utf-8');
      const msg = JSON.parse(content);
      msg.read = true;
      await fs.writeFile(msgFile, JSON.stringify(msg, null, 2));
    } catch (error) {
      console.error(`[邮箱] 标记已读失败：${messageId}`, error.message);
    }
  }

  /**
   * 批量标记已读
   */
  async markBatchAsRead(messageIds, agent) {
    for (const messageId of messageIds) {
      await this.markAsRead(messageId, agent);
    }
  }

  /**
   * 未读计数
   */
  async count(agent) {
    const agentDir = path.join(this.mailboxDir, this.toDirName(agent));
    
    try {
      const files = await fs.readdir(agentDir);
      return files.filter(f => 
        f.endsWith('.json') && !f.startsWith('.tmp') && !f.startsWith('read')
      ).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取未读消息（API 用）
   */
  async getUnread(agent) {
    return await this.receive(agent, false);
  }

  /**
   * 清理旧消息（保留最近 100 条）
   */
  async cleanup(agent, keep = 100) {
    const agentDir = path.join(this.mailboxDir, this.toDirName(agent));
    const readDir = path.join(agentDir, 'read');
    
    try {
      const files = await fs.readdir(readDir);
      if (files.length > keep) {
        // 删除最旧的文件
        const toDelete = files.slice(0, files.length - keep);
        for (const file of toDelete) {
          await fs.unlink(path.join(readDir, file));
        }
        console.log(`[邮箱] 清理 ${agent} 已读消息，删除 ${toDelete.length} 条`);
      }
    } catch (error) {
      console.error(`[邮箱] 清理失败:`, error.message);
    }
  }
}

module.exports = new MailboxService();
