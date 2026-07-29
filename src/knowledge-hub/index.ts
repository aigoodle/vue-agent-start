/**
 * @agent-start/knowledge-hub — public entry point.
 *
 * See README.md for usage. Quick recap:
 *
 *   import { KnowledgeHubApp, createSpringAgentStartAdapter } from '@agent-start/knowledge-hub'
 *   import '@agent-start/knowledge-hub/style.css'
 *
 *   <KnowledgeHubApp :api="createSpringAgentStartAdapter({baseUrl: '/api/agent-start'})" />
 *
 * Consumers with a non-spring-agent-start backend implement the `KnowledgeHubApi`
 * interface themselves (see types/api.ts — it's split into small sub-interfaces
 * so partial implementations are easy).
 */

// --- Style tokens (defaults). Consumers can also import '@agent-start/knowledge-hub/style.css'
// separately if they want to control when the CSS is injected.
import './styles/index.css';

// --- Drop-in top-level
export { default as KnowledgeHubApp } from './components/KnowledgeHubApp.vue';

// --- Building blocks
export { default as CreateDatasetWizard } from './components/CreateDatasetWizard.vue';
export { default as DatasetCardGrid } from './components/DatasetCardGrid.vue';
export { default as DatasetDetailDrawer } from './components/DatasetDetailDrawer.vue';
export { default as DatasetSettingsPanel } from './components/DatasetSettingsPanel.vue';
export { default as DatasetSidebar } from './components/DatasetSidebar.vue';
export { default as DocumentChunksView } from './components/DocumentChunksView.vue';
export { default as DocumentTable } from './components/DocumentTable.vue';
export { default as RecallTestingPanelV2 } from './components/RecallTestingPanelV2.vue';

// --- Legacy widgets (still used by /workflow KNOWLEDGE_RETRIEVAL node etc.)
export { default as DatasetPicker } from './components/DatasetPicker.vue';
export { default as DatasetPickerModal } from './components/DatasetPickerModal.vue';
export { default as HitTestingPanel } from './components/HitTestingPanel.vue';
export { default as RetrievedList } from './components/RetrievedList.vue';

// --- Adapters (implement KnowledgeHubApi against a known backend)
export { createSpringAgentStartAdapter } from './adapters/springAgentStart';

// --- Composables
export * from './composables/useKnowledge';

// --- All types re-exported from a single surface
export * from './types';
