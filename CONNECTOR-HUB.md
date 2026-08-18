# Connector Hub 使用说明

## 宿主接入

```ts
import { createAgentStartClient, installAgentStartClient } from 'vue-agent-start';
import 'vue-agent-start/style.css';

const client = createAgentStartClient({
  baseUrl: '/api',
  getAccessToken: () => authStore.token,
  getTenant: () => tenantStore.id,
});
app.use(installAgentStartClient, client);
```

```vue
<script setup lang="ts">
import { ConnectorHubApp } from 'vue-agent-start/connector-hub';
</script>
<template><ConnectorHubApp tenant-id="default" /></template>
```

`ConnectorHubApp` 提供 Connector 目录、租户同步、启停、加密连接配置、Action 测试、
OpenClaw 插件生命周期和执行审计。浏览器始终访问 Java 管理 API，不接触 Bridge Token。
详情抽屉支持同一 Connector 的多连接管理。连接“验证”只确认租户归属和加密数据可读；
真正的外部服务连通性应使用对应 Action 的测试按钮确认。OpenClaw 插件自己的账号配置在
“OpenClaw 插件”页签完成。

## Agent 与工作流

Connector Action 自动出现在 Agent Studio 工具选择器的 `Connector` 分类中，保存时仍使用
稳定的 `connector__provider__connector__action` 工具名。

工作流设计器的工具分类包含 `CONNECTOR` 节点。节点依次选择 Connector、Action 和连接，
并根据 Action JSON Schema 生成参数表单；字符串参数支持 `{{#node.field#}}` 变量模板。

## 独立 SDK

```ts
const catalog = await client.connectors.list();
await client.connectors.synchronize('default');
await client.connectors.execute('openclaw', 'plugin-id', 'tool-name', { text: 'hello' });
```
