#!/usr/bin/env python3
import urllib.request
import json
import time

# 获取 token
token_data = json.dumps({
    "app_id": "cli_a9242655a1ba1cb1",
    "app_secret": "EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU"
}).encode()

req = urllib.request.Request(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    data=token_data,
    headers={"Content-Type": "application/json"}
)
response = urllib.request.urlopen(req)
TOKEN = json.loads(response.read()).get('tenant_access_token', '')

print(f"Token: {TOKEN[:20]}...")

# 正确的 user_id 映射
USER_MAP = {
    '天枢': 'ou_82e24fd5850f184e395ecaa7d11a1ddc',
    '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
    '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
    '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
    '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
    '灵犀': 'ou_afd48fe16ccb4d2ba8a56235eb29d784',
    '磊哥': 'ou_de94b16d442425be15d96344fdd271f8'
}

CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4'

print("\n=== 开始测试@所有人 ===\n")

for name, user_id in USER_MAP.items():
    content = {
        "text": f"🔔 手工测试 - @{name}\n请确认收到",
        "at": {
            "user_id": [user_id],
            "all": False
        }
    }
    
    body = {
        "receive_id": CHAT_ID,
        "msg_type": "text",
        "content": json.dumps(content)
    }
    
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}"
        }
    )
    
    try:
        response = urllib.request.urlopen(req)
        result = json.loads(response.read())
        code = result.get('code')
        msg_id = result.get('data', {}).get('message_id', '')
        print(f'{name}: {"✅ 成功" if code == 0 else "❌ 失败"} ({msg_id})')
    except Exception as e:
        print(f'{name}: ❌ 错误 {e}')
    
    time.sleep(0.5)

print('\n=== 请磊哥在飞书群查看每条消息的@效果 ===')
