/**
 * `client.knowledge` — dataset / document / segment / retrieval REST layer
 * (`/datasets/...`). Methods return the backend's raw wire rows; the
 * knowledge-hub adapter maps them into the hub's view types.
 */
import type { ChunkPreview } from '../knowledge-hub/types';
import type { RetrieveRequest } from '../knowledge-hub/types';
import { qs, type HttpCore } from './core';

/** Raw dataset row as the backend returns it. */
export interface DatasetWire {
  id: string;
  name: string;
  description?: string;
  tenantId?: string;
  documentCount?: number;
  segmentCount?: number;
  indexingTechnique?: string;
  updatedAt?: string;
  processRuleJson?: string;
  [k: string]: unknown;
}

/** Raw document row. */
export interface DocumentWire {
  id: string;
  name: string;
  sourceType?: string;
  wordCount?: number;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  enabled?: boolean;
  parserName?: string;
  mediaType?: string;
  pageCount?: number;
  blockCount?: number;
  parseWarningsJson?: unknown;
  fileSize?: number;
  [k: string]: unknown;
}

/** Raw segment/chunk row. */
export interface SegmentWire {
  id: string;
  position?: number;
  content?: string;
  tokenCount?: number;
  enabled?: boolean;
  keywords?: string;
  [k: string]: unknown;
}

/** Raw retrieval hit. */
export interface RetrieveHitWire {
  segmentId: string;
  content: string;
  position?: number;
  score?: number;
  [k: string]: unknown;
}

/** Raw recall-history row. */
export interface RecallHistoryWire {
  id: string;
  query: string;
  method?: string;
  hitCount?: number;
  createdAt?: string;
  [k: string]: unknown;
}

export interface KnowledgeNamespace {
  // datasets
  /** GET /datasets — `tenantId` is an optional backend-side filter. */
  listDatasets(tenantId?: string): Promise<DatasetWire[]>;
  getDataset(id: string): Promise<DatasetWire>;
  createDataset(req: Record<string, unknown>): Promise<DatasetWire>;
  updateDataset(id: string, patch: Record<string, unknown>): Promise<DatasetWire>;
  deleteDataset(id: string): Promise<void>;

  // documents
  listDocuments(datasetId: string): Promise<DocumentWire[]>;
  getDocument(datasetId: string, docId: string): Promise<DocumentWire>;
  uploadDocument(datasetId: string, file: File): Promise<void>;
  deleteDocument(datasetId: string, docId: string): Promise<void>;
  getParsedDocument(datasetId: string, docId: string): Promise<unknown>;
  reparseDocument(datasetId: string, docId: string): Promise<DocumentWire>;
  previewChunks(file: File, rule: unknown, limit?: number): Promise<ChunkPreview>;

  // segments
  listSegments(
    datasetId: string,
    docId: string,
    page?: number,
    pageSize?: number,
  ): Promise<SegmentWire[]>;
  updateSegment(
    datasetId: string,
    docId: string,
    segId: string,
    content: string,
  ): Promise<SegmentWire>;
  deleteSegment(datasetId: string, docId: string, segId: string): Promise<void>;
  setSegmentEnabled(
    datasetId: string,
    docId: string,
    segId: string,
    enabled: boolean,
  ): Promise<SegmentWire>;
  appendSegment(datasetId: string, docId: string, content: string): Promise<SegmentWire>;

  // retrieval
  retrieve(datasetId: string, req: RetrieveRequest): Promise<RetrieveHitWire[]>;
  listRecallHistory(datasetId: string, limit?: number): Promise<RecallHistoryWire[]>;
}

export function createKnowledgeNamespace(core: HttpCore): KnowledgeNamespace {
  function docs(datasetId: string): string {
    return `/datasets/${encodeURIComponent(datasetId)}/documents`;
  }
  function segments(datasetId: string, docId: string): string {
    return `${docs(datasetId)}/${encodeURIComponent(docId)}/segments`;
  }

  return {
    listDatasets: async (tenantId) =>
      core.request<DatasetWire[]>(`/datasets${qs({ tenantId })}`),
    getDataset: (id) => core.request<DatasetWire>(`/datasets/${encodeURIComponent(id)}`),
    createDataset: (req) =>
      core.request<DatasetWire>('/datasets', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    updateDataset: (id, patch) =>
      core.request<DatasetWire>(`/datasets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    deleteDataset: (id) =>
      core.request<void>(`/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    listDocuments: (datasetId) => core.request<DocumentWire[]>(docs(datasetId)),
    getDocument: (datasetId, docId) =>
      core.request<DocumentWire>(`${docs(datasetId)}/${encodeURIComponent(docId)}`),
    uploadDocument: (datasetId, file) => {
      const form = new FormData();
      form.append('file', file);
      // Multipart — the browser fills in the boundary; core skips Content-Type.
      return core.upload<void>(`${docs(datasetId)}/upload`, form);
    },
    deleteDocument: (datasetId, docId) =>
      core.request<void>(`${docs(datasetId)}/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      }),
    getParsedDocument: (datasetId, docId) =>
      core.request(`${docs(datasetId)}/${encodeURIComponent(docId)}/parsed`),
    reparseDocument: (datasetId, docId) =>
      core.request<DocumentWire>(
        `${docs(datasetId)}/${encodeURIComponent(docId)}/reparse`,
        { method: 'POST' },
      ),
    previewChunks: (file, rule, limit = 10) => {
      const form = new FormData();
      form.append('file', file);
      form.append(
        'rule',
        new Blob([JSON.stringify(rule ?? {})], { type: 'application/json' }),
      );
      return core.upload<ChunkPreview>(`/datasets/preview-chunks${qs({ limit })}`, form);
    },

    listSegments: (datasetId, docId, page = 1, pageSize = 20) =>
      core.request<SegmentWire[]>(
        `${segments(datasetId, docId)}${qs({ page, pageSize })}`,
      ),
    updateSegment: (datasetId, docId, segId, content) =>
      core.request<SegmentWire>(`${segments(datasetId, docId)}/${encodeURIComponent(segId)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    deleteSegment: (datasetId, docId, segId) =>
      core.request<void>(`${segments(datasetId, docId)}/${encodeURIComponent(segId)}`, {
        method: 'DELETE',
      }),
    setSegmentEnabled: (datasetId, docId, segId, enabled) =>
      core.request<SegmentWire>(
        `${segments(datasetId, docId)}/${encodeURIComponent(segId)}/enabled`,
        { method: 'PUT', body: JSON.stringify({ enabled }) },
      ),
    appendSegment: (datasetId, docId, content) =>
      core.request<SegmentWire>(segments(datasetId, docId), {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),

    retrieve: (datasetId, req) =>
      core.request<RetrieveHitWire[]>(
        `/datasets/${encodeURIComponent(datasetId)}/retrieve`,
        {
          method: 'POST',
          body: JSON.stringify({
            method: req.method,
            query: req.query,
            topK: req.topK ?? 10,
            scoreThreshold: req.scoreThreshold,
            vectorWeight: req.vectorWeight,
            metadataFilter: req.metadataFilter,
          }),
        },
      ),
    listRecallHistory: (datasetId, limit = 20) =>
      core.request<RecallHistoryWire[]>(
        `/datasets/${encodeURIComponent(datasetId)}/hit-testing/history${qs({ limit })}`,
      ),
  };
}
