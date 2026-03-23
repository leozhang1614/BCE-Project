const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../runtime/bce-data.json');

// 加载数据
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// 清空所有任务
console.log(`📊 删除前：${data.tasks.length} 个任务`);
data.tasks = [];
data.subTasks = [];

// 保存
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('✅ 所有任务已删除');
console.log(`📊 删除后：${data.tasks.length} 个任务`);
