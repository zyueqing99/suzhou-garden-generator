import type { SiteMarkup, SitePoint } from './siteAnalysis';

export interface SiteMarkupCaptureSize {
  width: number;
  height: number;
}

export async function captureAnnotatedSiteImage({
  imageUrl,
  markup,
  width = 1536,
  height = 1024,
}: {
  imageUrl: string;
  markup: SiteMarkup;
  width?: number;
  height?: number;
}): Promise<string> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法生成带标注场地图：浏览器不支持 Canvas');
  }

  context.fillStyle = '#f7f4ec';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  drawMarkup(context, markup, { width, height });

  // 返回的是新合成的带标注 PNG，不是上传场地图原图。
  return canvas.toDataURL('image/png');
}

export function buildSiteMarkupSvg(markup: SiteMarkup, size: SiteMarkupCaptureSize): string {
  const boundary = pointsToPixelAttribute(markup.boundary, size);
  const building = pointsToPixelAttribute(markup.buildingFootprint, size);
  const entrance = markup.mainEntrance ? pointToPixel(markup.mainEntrance.point, size) : null;
  const view = markup.mainViewSide ? pointToPixel(markup.mainViewSide.point, size) : null;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">`,
    boundary ? `<polygon points="${boundary}" fill="rgba(19,97,76,0.10)" stroke="#0f5a47" stroke-width="4"/>` : '',
    building ? `<polygon points="${building}" fill="rgba(58,95,122,0.14)" stroke="#315f7a" stroke-width="4"/>` : '',
    entrance
      ? `<circle cx="${entrance.x}" cy="${entrance.y}" r="14" fill="#d8a338" stroke="#4e3510" stroke-width="4"/><text x="${
          entrance.x + 18
        }" y="${entrance.y + 6}" font-size="24" fill="#4e3510">主入口</text>`
      : '',
    view
      ? `<path d="M ${view.x} ${view.y - 20} L ${view.x + 18} ${view.y + 16} L ${view.x - 18} ${
          view.y + 16
        } Z" fill="#0f5a47"/><text x="${view.x + 22}" y="${view.y + 8}" font-size="24" fill="#0f5a47">景观方向</text>`
      : '',
    '</svg>',
  ].join('');
}

function drawMarkup(context: CanvasRenderingContext2D, markup: SiteMarkup, size: SiteMarkupCaptureSize) {
  drawPolygon(context, markup.boundary, size, '#0f5a47', 'rgba(19,97,76,0.10)');
  drawPolygon(context, markup.buildingFootprint, size, '#315f7a', 'rgba(58,95,122,0.14)');

  if (markup.mainEntrance) {
    const point = pointToPixel(markup.mainEntrance.point, size);
    context.fillStyle = '#d8a338';
    context.strokeStyle = '#4e3510';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(point.x, point.y, 14, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    drawLabel(context, '主入口', point.x + 18, point.y + 6, '#4e3510');
  }

  if (markup.mainViewSide) {
    const point = pointToPixel(markup.mainViewSide.point, size);
    context.fillStyle = '#0f5a47';
    context.beginPath();
    context.moveTo(point.x, point.y - 20);
    context.lineTo(point.x + 18, point.y + 16);
    context.lineTo(point.x - 18, point.y + 16);
    context.closePath();
    context.fill();
    drawLabel(context, '景观方向', point.x + 22, point.y + 8, '#0f5a47');
  }
}

function drawPolygon(context: CanvasRenderingContext2D, points: SitePoint[], size: SiteMarkupCaptureSize, strokeStyle: string, fillStyle: string) {
  if (points.length === 0) {
    return;
  }

  const first = pointToPixel(points[0], size);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const pixel = pointToPixel(point, size);
    context.lineTo(pixel.x, pixel.y);
  }
  if (points.length >= 3) {
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }
  context.strokeStyle = strokeStyle;
  context.lineWidth = 4;
  context.stroke();
}

function drawLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  context.font = '24px sans-serif';
  context.fillStyle = color;
  context.fillText(label, x, y);
}

function pointsToPixelAttribute(points: SitePoint[], size: SiteMarkupCaptureSize) {
  return points
    .map((point) => {
      const pixel = pointToPixel(point, size);
      return `${pixel.x},${pixel.y}`;
    })
    .join(' ');
}

function pointToPixel(point: SitePoint, size: SiteMarkupCaptureSize) {
  return {
    x: Math.round((point.x / 100) * size.width),
    y: Math.round((point.y / 100) * size.height),
  };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}
