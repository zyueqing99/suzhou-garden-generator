import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleImageRequest(request: IncomingMessage, response: ServerResponse): Promise<void>;
export function resolveVectorTimeoutMs(value: string | undefined): number;
export function resolveMaxBodyBytes(value: string | undefined): number;
export function isSafeImageUrl(value: unknown): boolean;
export function normalizeProxyError(error: unknown): { code: string; message: string; retryable: boolean };
export function readJsonBodyWithLimit(request: AsyncIterable<Buffer | Uint8Array | string>, limitBytes?: number): Promise<unknown>;
