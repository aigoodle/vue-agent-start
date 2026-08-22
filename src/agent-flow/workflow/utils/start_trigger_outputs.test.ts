import { describe, expect, it } from 'vitest';

import workflowUtils from './workflow_utils';

describe('START message connector outputs', () => {
  it('exposes triggers account fields to downstream variable selectors before opening config', () => {
    const nodeData: any = {
      triggersEnabled: true,
      triggers: { type: 'connector', provider: 'openclaw', channelId: 'qqbot' },
      output: [{ name: 'query', type: 'string' }],
      structOutput: {
        data: [{ name: 'triggers', type: 'object', children: [{ name: 'type', type: 'string' }] }],
      },
    };

    const outputs = workflowUtils.getOutputList(nodeData);
    const triggers = outputs.find((item: any) => item.name === 'triggers');

    expect(outputs).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'query' })]));
    expect(triggers.type).toBe('object');
    expect(triggers.children.map((item: any) => item.name)).toEqual(expect.arrayContaining([
      'channelId', 'channelName', 'connectionId', 'instanceName',
      'accountId', 'runtimeAccountId',
    ]));
    expect(triggers.children.map((item: any) => item.name)).not.toEqual(expect.arrayContaining([
      'senderId', 'replyTargetId', 'conversationId', 'messageId', 'messageType', 'group',
      'tenantId', 'userId', 'ownerId', 'ownerType',
    ]));
    expect(outputs.find((item: any) => item.name === 'message')?.children)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'content' }),
        expect.objectContaining({ name: 'senderId' }),
        expect.objectContaining({ name: 'replyTargetId' }),
        expect.objectContaining({ name: 'tenantId' }),
        expect.objectContaining({ name: 'userId' }),
      ]));
  });
});
