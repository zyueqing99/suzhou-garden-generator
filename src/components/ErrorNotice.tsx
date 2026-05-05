import type { GenerationError } from '../domain/project';

interface ErrorNoticeProps {
  error: GenerationError;
}

export function ErrorNotice({ error }: ErrorNoticeProps) {
  return (
    <div className="error-notice" role="alert">
      <strong>{error.message}</strong>
      <span>{error.retryable ? '可以稍后重试，场地图标注和生成参数已保留。' : '请调整配置或请求后再试。'}</span>
    </div>
  );
}
