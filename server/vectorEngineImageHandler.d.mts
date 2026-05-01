import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleImageRequest(request: IncomingMessage, response: ServerResponse): Promise<void>;
