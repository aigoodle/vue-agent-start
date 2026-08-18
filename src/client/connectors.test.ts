import { describe, expect, it, vi } from 'vitest';
import { createConnectorsNamespace } from './connectors';

describe('connectors namespace', () => {
  it('encodes connector identifiers and tenant query parameters', async () => {
    const request = vi.fn().mockResolvedValue({ success: true });
    const api = createConnectorsNamespace({ request } as any);
    await api.execute('open claw', 'qq/bot', 'send message', { text: 'hi' }, 'tenant one');
    expect(request).toHaveBeenCalledWith(
      '/connectors/open%20claw/qq%2Fbot/actions/send%20message/execute?tenantId=tenant%20one',
      { method: 'POST', body: JSON.stringify({ text: 'hi' }) },
    );
  });

  it('uses explicit lifecycle endpoints', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createConnectorsNamespace({ request } as any);
    await api.setInstallationEnabled('install/1', false, 'acme');
    await api.setPluginEnabled('plugin/1', true);
    expect(request.mock.calls[0][0]).toBe('/connector-installations/install%2F1/disable?tenantId=acme');
    expect(request.mock.calls[1][0]).toBe('/openclaw/plugins/plugin%2F1/enable');
  });
});
