import { loadLocalEnv } from './loadLocalEnv.mjs';

loadLocalEnv();

const vectorBaseUrl = process.env.VECTOR_ENGINE_BASE_URL || 'https://api.vectorengine.cn';
const apiKey = process.env.VECTOR_ENGINE_API_KEY;
const vectorTimeoutMs = resolveVectorTimeoutMs(process.env.VECTOR_ENGINE_TIMEOUT_MS);
const maxBodyBytes = resolveMaxBodyBytes(process.env.IMAGE_PROXY_MAX_BODY_BYTES);
const proxyAccessToken = process.env.IMAGE_PROXY_ACCESS_TOKEN;

export async function handleImageRequest(request, response) {
  try {
    if (!apiKey) {
      sendProxyError(response, 500, {
        code: 'missing_api_key',
        message: 'Missing VECTOR_ENGINE_API_KEY on local proxy server.',
        retryable: false,
      });
      return;
    }

    if (proxyAccessToken && request.headers.authorization !== `Bearer ${proxyAccessToken}`) {
      sendProxyError(response, 401, {
        code: 'invalid_request',
        message: 'Image proxy authorization failed.',
        retryable: false,
      });
      return;
    }

    const body = await readJsonBodyWithLimit(request);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      sendProxyError(response, 400, {
        code: 'invalid_request',
        message: 'prompt is required',
        retryable: false,
      });
      return;
    }

    const mode = body.mode === 'edit' ? 'edit' : 'generate';
    if (mode === 'edit' && body.imageUrl && !isSafeImageUrl(body.imageUrl)) {
      sendProxyError(response, 400, {
        code: 'invalid_request',
        message: 'Reference image URL is not allowed.',
        retryable: false,
      });
      return;
    }

    const vectorResponse =
      mode === 'edit' && body.imageUrl
        ? await requestImageEdit(body, prompt)
        : await requestImageGeneration(body, prompt);

    await forwardVectorResponse(vectorResponse, response);
  } catch (error) {
    const proxyError = normalizeProxyError(error);
    sendProxyError(response, proxyError.code === 'request_too_large' ? 413 : 500, proxyError);
  }
}

async function requestImageGeneration(body, prompt) {
  const vectorPayload = {
    model: 'gpt-image-2',
    prompt,
    n: clampImageCount(body.n),
    size: body.size || '1536x1024',
    quality: body.quality || 'medium',
    format: body.format || 'png',
  };

  return fetchWithTimeout(`${vectorBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(vectorPayload),
  });
}

async function requestImageEdit(body, prompt) {
  const imageUrl = String(body.imageUrl);

  try {
    const imageResponse = await fetchWithTimeout(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Unable to download source image: HTTP ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const formData = new FormData();
    formData.append('image', imageBlob, filenameFromContentType(imageResponse.headers.get('content-type')));
    formData.append('prompt', prompt);
    formData.append('model', 'gpt-image-2');
    formData.append('n', String(clampImageCount(body.n)));
    formData.append('size', body.size || '1536x1024');
    formData.append('quality', body.quality || 'medium');
    formData.append('response_format', 'url');

    const editResponse = await fetchWithTimeout(`${vectorBaseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    if (editResponse.ok) {
      return editResponse;
    }

    const errorText = await editResponse.text();
    console.warn(`VectorEngine edits endpoint failed (${editResponse.status}), falling back to gpt-image-2-all: ${errorText}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`VectorEngine edits endpoint unavailable, falling back to gpt-image-2-all: ${message}`);
  }

  return requestImageReferenceEdit(body, prompt, imageUrl);
}

async function requestImageReferenceEdit(body, prompt, imageUrl) {
  const vectorPayload = {
    model: 'gpt-image-2-all',
    prompt,
    n: clampImageCount(body.n),
    size: body.size || '1536x1024',
    image: [imageUrl],
  };

  return fetchWithTimeout(`${vectorBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(vectorPayload),
  });
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), vectorTimeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`VectorEngine request timed out after ${Math.round(vectorTimeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function forwardVectorResponse(vectorResponse, response) {
  const text = await vectorResponse.text();
  response.writeHead(vectorResponse.status, {
    'Content-Type': vectorResponse.headers.get('content-type') || 'application/json',
  });
  response.end(text);
}

function authHeaders() {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function jsonHeaders() {
  return {
    ...authHeaders(),
    'Content-Type': 'application/json',
  };
}

function clampImageCount(value) {
  const count = Number(value || 1);
  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.trunc(count)));
}

function filenameFromContentType(contentType) {
  if (contentType?.includes('webp')) {
    return 'source.webp';
  }
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
    return 'source.jpg';
  }
  return 'source.png';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

export function resolveVectorTimeoutMs(value) {
  return parsePositiveInteger(value, 300000);
}

export function resolveMaxBodyBytes(value) {
  return parsePositiveInteger(value, 5242880);
}

export function normalizeProxyError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (error && typeof error === 'object' && 'code' in error) {
    return error;
  }

  if (message.includes('timed out')) {
    return {
      code: 'provider_timeout',
      message: 'Image generation timed out. You can retry, or export the rule-generated concept plan.',
      retryable: true,
    };
  }

  return {
    code: 'unknown_error',
    message: 'Image generation failed. The rule-generated concept plan is still available.',
    retryable: true,
  };
}

export function isSafeImageUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.startsWith('data:image/png;base64,') || value.startsWith('data:image/jpeg;base64,') || value.startsWith('data:image/webp;base64,')) {
    return true;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return !(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

export async function readJsonBodyWithLimit(request, limitBytes = maxBodyBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > limitBytes) {
      throw {
        code: 'request_too_large',
        message: 'The reference image is too large. Use an image under the configured limit.',
        retryable: false,
      };
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function sendProxyError(response, status, error) {
  sendJson(response, status, { error });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
