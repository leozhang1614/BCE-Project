#!/bin/bash

# BCE v3.4.2 一键安装脚本
# 使用方式：bash install.sh

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   BCE v3.4.2 一键安装脚本                                 ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 16+"
    exit 1
fi

echo "✅ Node.js 版本：$(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未检测到 npm，请先安装 npm"
    exit 1
fi

echo "✅ npm 版本：$(npm -v)"

# 创建 .env.local 文件
if [ ! -f .env.local ]; then
    echo "📝 创建 .env.local 配置文件..."
    cat > .env.local << 'EOF'
# 飞书配置（请替换为真实值）
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_CHAT_ID=your_chat_id

# 服务配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
EOF
    echo "⚠️  请编辑 .env.local 文件，填入真实的飞书配置！"
else
    echo "✅ .env.local 已存在"
fi

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 检查安装结果
if [ $? -eq 0 ]; then
    echo "✅ 依赖安装完成"
else
    echo "❌ 依赖安装失败"
    exit 1
fi

# 创建日志目录
mkdir -p logs
mkdir -p runtime/inboxes

# 启动服务
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   安装完成！                                              ║"
echo "║                                                           ║"
echo "║   启动服务：nohup node src/index.js > logs/bce.log 2>&1 & ║"
echo "║   查看状态：curl http://localhost:3000/health             ║"
echo "║   查看日志：tail -f logs/bce.log                          ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🔐 重要提示："
echo "1. 请编辑 .env.local 文件，填入真实的飞书配置"
echo "2. 不要将 .env.local 提交到 Git"
echo "3. 生产环境请使用环境变量"
echo ""
