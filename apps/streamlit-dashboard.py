"""
北斗智投 Phase 2 实时监控看板

功能：
1. 系统健康监控
2. API 调用统计
3. 任务执行进度
4. 进化日志展示
5. 告警信息
"""

import streamlit as st
import requests
import pandas as pd
from datetime import datetime

# 页面配置
st.set_page_config(
    page_title="北斗智投 Phase 2 监控看板",
    page_icon="📊",
    layout="wide"
)

# BCE API 基础地址
BCE_API_BASE = "http://localhost:3000/api/bce"

# 标题
st.title("📊 北斗智投 Phase 2 监控看板")
st.markdown("---")

# 侧边栏
st.sidebar.header("导航")
page = st.sidebar.radio(
    "选择页面",
    ["系统健康", "API 统计", "任务进度", "进化日志", "告警信息"]
)

st.sidebar.markdown("---")
st.sidebar.markdown("**最后更新:** " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

# 刷新按钮
if st.sidebar.button("🔄 刷新数据"):
    st.rerun()

# ==================== 系统健康页面 ====================
if page == "系统健康":
    st.header("🏥 系统健康状态")
    
    try:
        # 获取健康状态
        health_response = requests.get(f"{BCE_API_BASE}/monitoring/health", timeout=5)
        health = health_response.json()
        
        # 显示关键指标
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric(
                label="服务状态",
                value="✅ 正常" if health.get('status') == 'ok' else "❌ 异常",
                delta=None
            )
        
        with col2:
            st.metric(
                label="运行时间",
                value=health.get('uptime', 'N/A'),
                delta=None
            )
        
        with col3:
            st.metric(
                label="API 成功率",
                value=health.get('api', {}).get('successRate', 'N/A'),
                delta=None
            )
        
        with col4:
            st.metric(
                label="API 调用数",
                value=health.get('api', {}).get('totalCalls', 0),
                delta=None
            )
        
        # 详细信息
        st.subheader("详细信息")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("**API 统计**")
            api_stats = health.get('api', {})
            st.json({
                "总调用": api_stats.get('totalCalls', 0),
                "失败次数": api_stats.get('totalFailures', 0),
                "端点数量": api_stats.get('endpoints', 0)
            })
        
        with col2:
            st.markdown("**内存使用**")
            memory = health.get('memory', {})
            st.json({
                "Heap Used (MB)": round(memory.get('heapUsed', 0) / 1024 / 1024, 2),
                "Heap Total (MB)": round(memory.get('heapTotal', 0) / 1024 / 1024, 2),
                "RSS (MB)": round(memory.get('rss', 0) / 1024 / 1024, 2)
            })
        
        # 错误信息
        st.subheader("最近错误")
        errors_response = requests.get(f"{BCE_API_BASE}/monitoring/errors?limit=10", timeout=5)
        errors_data = errors_response.json()
        
        if errors_data.get('data', {}).get('count', 0) > 0:
            errors_df = pd.DataFrame(errors_data['data']['errors'])
            st.dataframe(errors_df, use_container_width=True)
        else:
            st.success("✅ 最近没有错误")
            
    except Exception as e:
        st.error(f"获取健康状态失败：{str(e)}")

# ==================== API 统计页面 ====================
elif page == "API 统计":
    st.header("📈 API 调用统计")
    
    try:
        stats_response = requests.get(f"{BCE_API_BASE}/monitoring/stats", timeout=5)
        stats_data = stats_response.json()
        
        if stats_data.get('success'):
            stats = stats_data['data']['stats']
            
            # 转换为 DataFrame
            if stats:
                df = pd.DataFrame([
                    {
                        "端点": endpoint,
                        "调用次数": data['count'],
                        "成功": data['success'],
                        "失败": data['failure'],
                        "平均耗时 (ms)": data['avgDuration'],
                        "最后调用": data['lastCall']
                    }
                    for endpoint, data in stats.items()
                ])
                
                # 按调用次数排序
                df = df.sort_values("调用次数", ascending=False)
                
                st.dataframe(df, use_container_width=True)
            else:
                st.info("暂无 API 调用数据")
        else:
            st.error("获取 API 统计失败")
            
    except Exception as e:
        st.error(f"获取 API 统计失败：{str(e)}")

# ==================== 任务进度页面 ====================
elif page == "任务进度":
    st.header("📋 任务执行进度")
    
    try:
        tasks_response = requests.get(f"{BCE_API_BASE}/tasks", timeout=5)
        tasks_data = tasks_response.json()
        
        if tasks_data.get('success'):
            tasks = tasks_data.get('data', [])
            
            # 统计状态
            status_count = {}
            for task in tasks:
                status = task.get('status', 'unknown')
                status_count[status] = status_count.get(status, 0) + 1
            
            # 显示状态分布
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("总任务数", len(tasks))
            
            with col2:
                executing = status_count.get('executing', 0) + status_count.get('reviewing', 0)
                st.metric("执行中", executing)
            
            with col3:
                accepted = status_count.get('accepted', 0)
                st.metric("已完成", accepted)
            
            # 任务列表
            st.subheader("任务列表")
            
            if tasks:
                tasks_df = pd.DataFrame([
                    {
                        "任务": task.get('title', 'N/A'),
                        "负责人": task.get('assignee', 'N/A'),
                        "状态": task.get('status', 'N/A'),
                        "优先级": task.get('priority', 'N/A'),
                        "创建时间": task.get('createdAt', 'N/A')[:19]
                    }
                    for task in tasks
                ])
                
                st.dataframe(tasks_df, use_container_width=True)
            else:
                st.info("暂无任务")
        else:
            st.error("获取任务列表失败")
            
    except Exception as e:
        st.error(f"获取任务列表失败：{str(e)}")

# ==================== 进化日志页面 ====================
elif page == "进化日志":
    st.header("🧠 自我进化日志")
    
    st.info("此功能需要实现 /api/bce/evolution/knowledge API")
    
    # 示例内容
    st.markdown("""
    ### 进化日志功能
    
    1. **交易复盘记录**
       - 展示最近的交易复盘分析
       - 五维评估结果
    
    2. **CRO 归因分析**
       - 收益归因统计
       - 策略效果评估
    
    3. **策略知识库**
       - 策略更新历史
       - 知识条目统计
    """)

# ==================== 告警信息页面 ====================
elif page == "告警信息":
    st.header("🚨 告警信息")
    
    try:
        alerts_response = requests.get(f"{BCE_API_BASE}/monitoring/alerts", timeout=5)
        alerts_data = alerts_response.json()
        
        if alerts_data.get('success'):
            current_alerts = alerts_data['data'].get('current', [])
            historical_alerts = alerts_data['data'].get('historical', [])
            
            # 当前告警
            st.subheader("当前告警")
            
            if current_alerts:
                for alert in current_alerts:
                    level = alert.get('level', 'info')
                    icon = "🔴" if level == 'critical' else "🟡" if level == 'warning' else "🔵"
                    
                    st.markdown(f"{icon} **{alert.get('type')}**")
                    st.markdown(f"   {alert.get('message')}")
                    st.markdown(f"   _时间：{alert.get('timestamp', 'N/A')}_")
                    st.markdown("---")
            else:
                st.success("✅ 当前没有告警")
            
            # 历史告警
            st.subheader("历史告警（最近 20 条）")
            
            if historical_alerts:
                alerts_df = pd.DataFrame(historical_alerts)
                st.dataframe(alerts_df, use_container_width=True)
            else:
                st.info("暂无历史告警")
        else:
            st.error("获取告警信息失败")
            
    except Exception as e:
        st.error(f"获取告警信息失败：{str(e)}")

# 页脚
st.markdown("---")
st.markdown("**北斗智投 Phase 2** | 运维监控看板 | 数据每 5 分钟自动刷新")
