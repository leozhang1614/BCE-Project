#!/usr/bin/env node
/**
 * 初始化 BCE 任务看板
 * 从 BCE 任务数据创建看板，确保看板有内容显示
 */

const fs = require('fs');
const path = require('path');

// BCE 数据文件路径
const BCE_DATA_PATH = path.join(__dirname, '../runtime/bce-data.json');

console.log('🚀 开始初始化 BCE 任务看板...');

// 读取 BCE 任务数据
let bceData;
try {
  const content = fs.readFileSync(BCE_DATA_PATH, 'utf-8');
  bceData = JSON.parse(content);
  console.log(`✅ 读取 BCE 数据成功，任务数：${bceData.tasks?.length || 0}`);
} catch (error) {
  console.error(`❌ 读取 BCE 数据失败：${error.message}`);
  process.exit(1);
}

// 创建看板数据
const board = {
  id: 'bce-main-board',
  name: 'BCE 主任务板',
  description: '北斗协同引擎 - 统一任务管理看板',
  members: ['匠心', '司库', '磐石', '执矩', '灵犀', '天策', '天枢'],
  tasks: bceData.tasks || [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// 保存看板数据
const BOARD_DATA_PATH = path.join(__dirname, '../runtime/board-data.json');
fs.writeFileSync(BOARD_DATA_PATH, JSON.stringify(board, null, 2), 'utf-8');

console.log(`✅ 看板数据已保存到：${BOARD_DATA_PATH}`);
console.log(`📊 看板信息:`);
console.log(`   - 看板 ID: ${board.id}`);
console.log(`   - 看板名称：${board.name}`);
console.log(`   - 任务数：${board.tasks.length}`);
console.log(`   - 成员数：${board.members.length}`);
console.log('\n✅ 初始化完成！请重启 BCE 服务以加载看板数据。');
