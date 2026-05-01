export function downloadSvg(svgElement: SVGSVGElement, filename: string) {
  const source = new XMLSerializer().serializeToString(svgElement);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${filename}.svg`);
}

export async function downloadPng(svgElement: SVGSVGElement, filename: string) {
  const source = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  const viewBox = svgElement.viewBox.baseVal;
  const width = viewBox.width || svgElement.clientWidth || 1080;
  const height = viewBox.height || svgElement.clientHeight || 760;

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('PNG 导出失败，无法读取 SVG 预览'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('PNG 导出失败，浏览器不支持 Canvas');
    }

    context.fillStyle = '#f7f4ec';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG 导出失败，无法生成图片文件'));
        }
      }, 'image/png');
    });

    downloadBlob(pngBlob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
