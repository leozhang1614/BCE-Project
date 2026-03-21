#!/usr/bin/env node
/**
 * 独立测试脚本 - 完全复制飞书 API 调用
 */

const https = require('https');

const TOKEN_DATA = JSON.stringify({
    app_id: 'cli_a9242655a1ba1cb1',
    app_secret: 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU'
});

const CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4';

// 正确的 user_id 映射
const USER_MAP = {
    '天枢': 'ou_82e24fd5850f184e395ecaa7d11a1ddc',
    '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
    '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
    '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
    '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
    '灵犀': 'ou_afd48fe16ccb4d2ba8a56235eb29d784',
    '磊哥': 'ou_de94b16d442425be15d96344fdd271f8'
};

function getToken() {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'open.feishu.cn',
            port: 443,
            path: '/open-apis/auth/v3/tenant_access_token/internal',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(TOKEN_DATA) }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                result.code === 0 ? resolve(result.tenant_access_token) : reject(new Error(result.msg));
            });
        });
        req.on('error', reject);
        req.write(TOKEN_DATA);
        req.end();
    });
}

async function sendMessage(name, userId) {
    const token = await getToken();
    
    // 完全复制 BCE 系统的格式
    const content = {
        text: `🔔 独立测试 - @${name}\n请确认收到`
    };
    
    // at 放在 content 内部
    content.at = {
        user_id: [userId],
        all: false
    };
    
    const body = {
        receive_id: CHAT_ID,
        msg_type: 'text',
        content: JSON.stringify(content)
    };
    
    console.log(`\n发送：${name}`);
    console.log(`content: ${JSON.stringify(content)}`);
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'open.feishu.cn',
            port: 443,
            path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(body)),
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                console.log(`${name}: ${result.code === 0 ? '✅ 成功' : '❌ 失败'} - ${result.msg}`);
                resolve(result.code === 0);
            });
        });
        req.on('error', (e) => {
            console.log(`${name}: ❌ 错误 ${e.message}`);
            resolve(false);
        });
        req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('=== 独立测试脚本 - 完全复制 BCE 系统格式 ===\n');
    
    for (const [name, userId] of Object.entries(USER_MAP)) {
        await sendMessage(name, userId);
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n=== 请磊哥在飞书群查看@效果 ===');
}

main().catch(console.error);
