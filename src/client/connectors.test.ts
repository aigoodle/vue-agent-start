import { describe, expect, it, vi } from 'vitest';
import { createConnectorsNamespace } from './connectors';

describe('connectors namespace', () => {
  it('encodes connector identifiers and never sends caller-supplied tenant parameters', async () => {
    const request = vi.fn().mockResolvedValue({ success: true });
    const api = createConnectorsNamespace({ request } as any);
    await api.execute('open claw', 'qq/bot', 'send message', { text: 'hi' }, 'tenant one');
    expect(request).toHaveBeenCalledWith(
      '/connectors/open%20claw/qq%2Fbot/actions/send%20message/execute',
      { method: 'POST', body: JSON.stringify({ text: 'hi' }) },
    );
  });

  it('uses explicit lifecycle endpoints', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createConnectorsNamespace({ request } as any);
    await api.setInstallationEnabled('install/1', false, 'acme');
    await api.setPluginEnabled('plugin/1', true);
    expect(request.mock.calls[0][0]).toBe('/connector-installations/install%2F1/disable');
    expect(request.mock.calls[1][0]).toBe('/openclaw/plugins/plugin%2F1/enable');
  });

  it('uses trusted current-tenant binding endpoints when the host omits tenantId', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createConnectorsNamespace({ request } as any);

    await api.getTenantAgentBinding();
    await api.saveTenantAgentBinding(undefined, { defaultAgentId: 'agent-1' });

    expect(request.mock.calls[0][0]).toBe('/tenant-agent-bindings/current');
    expect(request.mock.calls[1]).toEqual([
      '/tenant-agent-bindings/current',
      { method: 'PUT', body: JSON.stringify({ defaultAgentId: 'agent-1' }) },
    ]);
  });

  it('encodes stable conversation page filters and cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const api = createConnectorsNamespace({ request } as any);

    await api.pageChannelConversations({
      provider: 'openclaw', channelId: 'qqbot', cursor: 'cursor+/=', limit: 50,
    });

    expect(request.mock.calls[0][0]).toBe(
      '/channel-conversations/page?provider=openclaw&channelId=qqbot&cursor=cursor%2B%2F%3D&limit=50',
    );
  });

  it('encodes channel audit filters without accepting a tenant parameter', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const api = createConnectorsNamespace({ request } as any);

    await api.listChannelAudits({
      action: 'CHANNEL MESSAGE REPLY', resourceType: 'CHANNEL_EVENT',
      resourceId: 'event/1', actorId: 'user+1', outcome: 'SUCCESS', limit: 25,
    });

    expect(request.mock.calls[0][0]).toBe(
      '/channel-audits?action=CHANNEL%20MESSAGE%20REPLY&resourceType=CHANNEL_EVENT&resourceId=event%2F1&actorId=user%2B1&outcome=SUCCESS&limit=25',
    );
  });

  it('uses bounded dead-letter operations without a tenant parameter', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const api = createConnectorsNamespace({ request } as any);
    await api.listChannelDeadLetters(50);
    await api.replayChannelDeadLetters(['event/1']);
    expect(request.mock.calls[0][0]).toBe('/channel-dead-letters?limit=50');
    expect(request.mock.calls[1]).toEqual(['/channel-dead-letters/replay', {
      method: 'POST', body: JSON.stringify({ eventIds: ['event/1'] }),
    }]);
  });

  it('streams OpenClaw plugin installation progress and returns the installed plugin', async () => {
    const raw = vi.fn().mockResolvedValue(new Response(
      'event: progress\ndata: {"percent":35,"stage":"INSTALLING","message":"正在安装"}\n\n' +
      'event: result\ndata: {"id":"email","name":"Email","enabled":true}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    ));
    const api = createConnectorsNamespace({ raw } as any);
    const onProgress = vi.fn();

    const plugin = await api.installPluginStream(
      { sourceType: 'clawhub', source: 'clawhub:email' }, onProgress,
    );

    expect(raw).toHaveBeenCalledWith('/openclaw/plugins/install/stream', {
      method: 'POST', headers: { Accept: 'text/event-stream' },
      body: JSON.stringify({ sourceType: 'clawhub', source: 'clawhub:email' }),
    }, { timeoutMs: 300_000 });
    expect(onProgress).toHaveBeenCalledWith({ percent: 35, stage: 'INSTALLING', message: '正在安装' });
    expect(plugin).toMatchObject({ id: 'email', enabled: true });
  });
});
