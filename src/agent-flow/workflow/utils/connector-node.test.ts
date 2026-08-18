import { describe, expect, it } from 'vitest';
import nodeCatalog from './node_config';
import nodeCardForm from './node_card_form';

describe('CONNECTOR workflow node', () => {
  it('is available in the palette with backend-compatible defaults', () => {
    expect(nodeCatalog.find(node => node.type === 'CONNECTOR')?.category).toBe('工具');
    expect(nodeCardForm.CONNECTOR).toMatchObject({ provider: '', connectorId: '', actionId: '', outputKey: 'result' });
  });
});
