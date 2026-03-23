/**
 * BCE v3.4 - 数据迁移脚本
 * 功能：为现有任务添加 v3.4 进度追踪字段
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../runtime/bce-data.json');

console.log('🔧 开始 BCE v3.4 数据迁移...');

try {
  // 加载数据
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const tasks = data.tasks || [];
  
  console.log(`📊 加载了 ${tasks.length} 个任务`);
  
  let updated = 0;
  
  // 遍历任务，添加 v3.4 字段
  tasks.forEach(task => {
    let needsUpdate = false;
    
    // 添加进度追踪字段
    if (task.progressPercent === undefined) {
      task.progressPercent = 0;
      needsUpdate = true;
    }
    
    if (task.progressUpdatedAt === undefined) {
      task.progressUpdatedAt = task.updatedAt || task.createdAt;
      needsUpdate = true;
    }
    
    if (task.missedUpdates === undefined) {
      task.missedUpdates = 0;
      needsUpdate = true;
    }
    
    if (task.progressAlerted === undefined) {
      task.progressAlerted = false;
      needsUpdate = true;
    }
    
    // 添加确认状态字段
    if (task.confirmStatus === undefined) {
      task.confirmStatus = task.confirmedAt ? 'confirmed' : 'pending';
      needsUpdate = true;
    }
    
    if (task.confirmDueAt === undefined) {
      if (task.confirmedAt) {
        const dueDate = new Date(task.confirmedAt);
        dueDate.setMinutes(dueDate.getMinutes() + 30);
        task.confirmDueAt = dueDate.toISOString();
      } else {
        const dueDate = new Date(task.createdAt);
        dueDate.setMinutes(dueDate.getMinutes() + 30);
        task.confirmDueAt = dueDate.toISOString();
      }
      needsUpdate = true;
    }
    
    if (task.autoExtensions === undefined) {
      task.autoExtensions = {
        meeting: 0,
        deepWork: 0,
        later: 0
      };
      needsUpdate = true;
    }
    
    if (task.completedWork === undefined) {
      task.completedWork = '';
      needsUpdate = true;
    }
    
    if (task.remainingWork === undefined) {
      task.remainingWork = task.description || '';
      needsUpdate = true;
    }
    
    if (task.estimatedComplete === undefined) {
      task.estimatedComplete = task.dueDate;
      needsUpdate = true;
    }
    
    if (task.blockers === undefined) {
      task.blockers = [];
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updated++;
      console.log(`✅ 更新任务：${task.title} (${task.id})`);
    }
  });
  
  // 保存数据
  data.tasks = tasks;
  data.migratedAt = new Date().toISOString();
  data.migrationVersion = 'v3.4';
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ 迁移完成！`);
  console.log(`📊 更新任务数：${updated}/${tasks.length}`);
  console.log(`💾 数据已保存到：${DATA_FILE}`);
  
} catch (error) {
  console.error('❌ 迁移失败:', error.message);
  process.exit(1);
}
