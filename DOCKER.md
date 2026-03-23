# BCE v3.4.2 Docker 部署

## 快速启动

```bash
# 1. 构建镜像
docker build -t bce:v3.4.2 .

# 2. 启动容器
docker run -d \
  --name bce \
  -p 3000:3000 \
  -e FEISHU_APP_ID=your_app_id \
  -e FEISHU_APP_SECRET=your_app_secret \
  -e FEISHU_CHAT_ID=your_chat_id \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/runtime:/app/runtime \
  bce:v3.4.2

# 3. 查看状态
docker ps | grep bce
curl http://localhost:3000/health

# 4. 查看日志
docker logs -f bce
```

## 停止服务

```bash
docker stop bce
docker rm bce
```

## 重启服务

```bash
docker restart bce
```
