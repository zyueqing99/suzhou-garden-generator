import { loadLocalEnv } from './loadLocalEnv.mjs';

loadLocalEnv();

const vectorBaseUrl = process.env.VECTOR_ENGINE_BASE_URL || 'https://api.vectorengine.cn';
const apiKey = process.env.VECTOR_ENGINE_API_KEY;
const vectorTimeoutMs = parsePositiveInteger(process.env.VECTOR_ENGINE_TIMEOUT_MS, 120000);

export async function handleImageRequest(request, response) {
  try {
    if (!apiKey) {
      sendJson(response, 500, { error: 'Missing VECTOR_ENGINE_API_KEY on local proxy server' });
      return;
    }

    const body = await readJsonBody(request);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      sendJson(response, 400, { error: 'prompt is required' });
      return;
    }

    const mode = body.mode === 'edit' ? 'edit' : 'generate';
    const vectorResponse =
      mode === 'edit' && body.imageUrl
        ? await requestImageEdit(body, prompt)
        : await requestImageGeneration(body, prompt);

    await forwardVectorResponse(vectorResponse, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown image proxy error';
    sendJson(response, 500, { error: message });
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

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
