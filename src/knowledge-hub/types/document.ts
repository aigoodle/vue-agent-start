/**
 * Document + chunk (segment) types.
 */

/** One row in the DocumentTable. */
export interface DocumentRow {
  id: string;
  name: string;
  /** "自定义" / "父子分段" — display string, not enum. */
  chunkMode?: string;
  wordCount?: number;
  hitCount?: number;
  uploadedAt?: string;
  status: 'AVAILABLE' | 'FAILED' | 'PROCESSING';
  enabled: boolean;
}

/** One chunk shown in DocumentChunksView. */
export interface Chunk {
  id: string;
  position: number;
  content: string;
  tokenCount?: number;
  charCount?: number;
  hitCount?: number;
  enabled: boolean;
  keywords?: string[];
}

/** Right-side metadata pane of DocumentChunksView. */
export interface DocMetadata {
  fileName?: string;
  kind?: string;
  size?: string;
  uploadedAt?: string;
  parsedAt?: string;
  embeddedAt?: string;
  chunkMode?: string;
  chunkMaxSize?: number;
  totalChars?: number;
  totalChunks?: number;
  avgChunkChars?: number;
  avgEmbedMs?: number;
  totalTokens?: number;
}
