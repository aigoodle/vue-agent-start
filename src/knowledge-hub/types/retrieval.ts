/**
 * Retrieval / hit-testing types.
 */

export type RetrievalMethod = 'FULL_TEXT' | 'HYBRID' | 'VECTOR';

export interface RetrieveRequest {
  query: string;
  method?: RetrievalMethod;
  topK?: number;
  scoreThreshold?: number;
  vectorWeight?: number;
  rerankEnabled?: boolean;
  rerankModelId?: string;
  rerankPoolSize?: number;
  maxChunksPerDocument?: number;
  metadataFilter?: Record<string, unknown>;
}

/** Row in the retrieval result list — from HybridRetriever. */
export interface RetrievedSegment {
  segmentId: string;
  datasetId: string;
  documentId: string;
  position: number;
  content: string;
  parentContent?: string;
  vectorScore: number;
  keywordScore: number;
  score: number;
  metadata?: Record<string, unknown>;
}

/** One row in the RecallTestingPanel result pane. Simpler than RetrievedSegment. */
export interface RecallHit {
  segmentId: string;
  content: string;
  position?: number;
  score: number;
  documentName?: string;
  documentId?: string;
  blockType?: string;
  heading?: string;
  metadata?: Record<string, unknown>;
  vectorScore?: number;
  keywordScore?: number;
}

/** Historical recall query row shown in the "记录" list. */
export interface RecentQuery {
  id: string;
  query: string;
  method: string;
  hitCount: number;
  at: string;
}
