import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleImageRequest,
  isSafeImageUrl,
  normalizeProxyError,
  readJsonBodyWithLimit,
  resolveMaxBodyBytes,
  resolveVectorTimeoutMs,
} from './vectorEngineImageHandler.mjs';

declare const request: IncomingMessage;
declare const response: ServerResponse;

const timeout: number = resolveVectorTimeoutMs(undefined);
const bodyLimit: number = resolveMaxBodyBytes(undefined);
const safe: boolean = isSafeImageUrl('https://example.com/a.png');
const error: { code: string; message: string; retryable: boolean } = normalizeProxyError(new Error('failed'));

void timeout;
void bodyLimit;
void safe;
void error;
void handleImageRequest(request, response);
void readJsonBodyWithLimit(request, 1024);
