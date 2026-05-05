import {
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  FileJson,
  ImageDown,
  ImagePlus,
  Layers,
  Map,
  MousePointer2,
  RefreshCw,
  Save,
  ScanLine,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAiImageRequest, buildSiteImagePrompt, normalizeUnknownGenerationError, requestAiImage } from '../aiImageClient';
import type { GardenProject, ImageGeneration } from '../domain/project';
import { downloadImageDataUrl, downloadJson } from '../exporters';
import type { GardenParameters } from '../gardenGenerator';
import { type PlanExplanationSection, buildPlanExplanation } from '../planExplanation';
import {
  appendSiteMarkupPoint,
  clearSiteMarkupByTool,
  createSiteAnalysis,
  emptySiteMarkup,
  normalizeSitePoint,
  type SiteAnalysisData,
  type SiteMarkup,
  type SiteMarkupTool,
  type SitePoint,
} from '../siteAnalysis';
import { captureAnnotatedSiteImage } from '../siteMarkupCapture';
import { ErrorNotice } from './ErrorNotice';

interface GardenWorkspaceProps {
  project: GardenProject;
  onProjectChange: (project: GardenProject) => void;
  onGenerationAdded: (generation: ImageGeneration) => void;
}

type WorkspaceTab = 'markup' | 'result' | 'explanation';

export function GardenWorkspace({ project, onProjectChange, onGenerationAdded }: GardenWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('markup');
  const [status, setStatus] = useState('请上传场地图并在右侧大图中完成标注');
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null);
  const [aiStatus, setAiStatus] = useState('AI 方案图尚未生成');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeTool, setActiveTool] = useState<SiteMarkupTool>('boundary');
  const siteCanvasRef = useRef<HTMLDivElement | null>(null);
  const siteMarkup = project.siteMarkup ?? emptySiteMarkup;
  const siteAnalysis = useMemo(() => createSiteAnalysis(siteMarkup), [siteMarkup]);
  const explanation = useMemo(
    () => buildPlanExplanation({ projectName: project.name, siteAnalysis, parameters: project.parameters, customPrompt: project.customPrompt }),
    [project.name, siteAnalysis, project.parameters, project.customPrompt],
  );
  const latestGeneration = project.generations[0];
  const latestError = latestGeneration?.status === 'failed' ? latestGeneration.error : undefined;
  const canGenerate = Boolean(project.siteImage) && siteMarkup.boundary.length >= 3 && siteMarkup.buildingFootprint.length >= 3 && Boolean(siteMarkup.mainEntrance);
  const activeSiteEditHint = getActiveToolHint(activeTool, siteMarkup);
  const mapEraseAction = getMapEraseAction(activeTool, siteMarkup);
  const filename = `suzhou-garden-${project.seed}`;

  useEffect(() => {
    const latestImageUrl = project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null;
    setAiImageUrl(latestImageUrl);
    setAiStatus(latestImageUrl ? '正在展示已保存的 AI 方案图' : 'AI 方案图尚未生成');
    setStatus(project.siteImage ? '请在右侧放大场地图中完成标注' : '请上传场地图并在右侧大图中完成标注');
    setActiveTab('markup');
  }, [project.id, project.generations, project.siteImage]);

  const updateParameter = <K extends keyof GardenParameters>(key: K, value: GardenParameters[K]) => {
    onProjectChange({
      ...project,
      updatedAt: new Date().toISOString(),
      parameters: { ...project.parameters, [key]: value },
    });
  };

  const updateSiteImage = (siteImage: GardenProject['siteImage']) => {
    onProjectChange({
      ...project,
      siteImage,
      siteMarkup: siteImage ? (project.siteMarkup ?? emptySiteMarkup) : undefined,
      updatedAt: new Date().toISOString(),
    });
    setActiveTab('markup');
  };

  const updateSiteMarkup = (updatedMarkup: SiteMarkup) => {
    onProjectChange({
      ...project,
      siteMarkup: updatedMarkup,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSiteUpload = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSiteImage({ name: file.name, url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSiteCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!project.siteImage || !siteCanvasRef.current) {
      return;
    }

    const rect = siteCanvasRef.current.getBoundingClientRect();
    const point = normalizeSitePoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
    updateSiteMarkup(appendSiteMarkupPoint(siteMarkup, activeTool, point));
  };

  const handleSiteCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    updateSiteMarkup(appendSiteMarkupPoint(siteMarkup, activeTool, { x: 50, y: 50 }));
  };

  const handleGenerate = async () => {
    if (!project.siteImage || !canGenerate) {
      setStatus('请先上传场地图，并确认地块边界、建筑轮廓和主入口。');
      setActiveTab('markup');
      return;
    }

    setIsGeneratingImage(true);
    setAiStatus('正在截取带标注场地图并生成 AI 方案...');

    const prompt = buildSiteImagePrompt({
      projectName: project.name,
      siteAnalysis,
      parameters: project.parameters,
      customDirection: project.customPrompt,
    });

    try {
      const annotatedImageUrl = await captureAnnotatedSiteImage({
        imageUrl: project.siteImage.url,
        markup: siteMarkup,
      });
      const request = buildAiImageRequest({
        mode: 'generate',
        prompt,
        referenceImageUrl: annotatedImageUrl,
        currentImageUrl: null,
      });
      const result = await requestAiImage(request);

      setAiImageUrl(result.imageUrl);
      setAiStatus('AI 方案图生成完成');
      setStatus('已根据带标注场地图生成方案');
      setActiveTab('result');
      onGenerationAdded({
        id: `generation-${Date.now()}`,
        projectId: project.id,
        createdAt: new Date().toISOString(),
        mode: 'generate',
        status: 'succeeded',
        prompt,
        provider: 'vectorengine',
        model: request.mode === 'edit' ? 'gpt-image-2-all' : 'gpt-image-2',
        imageUrl: result.imageUrl,
      });
    } catch (error) {
      const generationError = normalizeUnknownGenerationError(error);
      setAiStatus(generationError.message);
      onGenerationAdded({
        id: `generation-${Date.now()}`,
        projectId: project.id,
        createdAt: new Date().toISOString(),
        mode: 'generate',
        status: 'failed',
        prompt,
        provider: 'vectorengine',
        model: 'gpt-image-2',
        error: generationError,
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const exportJsonPayload = {
    project,
    siteMarkup,
    siteAnalysis,
    generationControls: project.parameters,
    explanation,
    latestGeneration,
  };

  return (
    <section className="workspace-shell" aria-label="场地图标注驱动的 AI 方案生成工作台">
      <TopAppBar onExport={() => aiImageUrl && downloadImageDataUrl(aiImageUrl, filename)} canExport={Boolean(aiImageUrl)} />
      <ProcessStepper />

      <div className="workspace-grid site-generation-grid">
        <aside className="workspace-controls" aria-label="左侧生成控制">
          <section className="control-card site-upload-panel" aria-label="场地图上传">
            <div className="card-title-row">
              <div>
                <h2>场地图</h2>
                <p>上传后在右侧大图中标注</p>
              </div>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
            <SiteImageUploader siteImage={project.siteImage} onUpload={handleSiteUpload} onRemove={() => updateSiteImage(undefined)} />
          </section>

          <section className="control-card site-tools-panel" aria-label="标注工具">
            <h2>标注工具</h2>
            <SiteToolButtons activeTool={activeTool} onToolChange={setActiveTool} ariaLabel="放大场地图标注工具" className="site-tool-grid" />
            {mapEraseAction ? (
              <button className="site-erase-button" type="button" onClick={() => updateSiteMarkup(clearSiteMarkupByTool(siteMarkup, mapEraseAction.tool))}>
                <X size={16} aria-hidden="true" />
                {mapEraseAction.label}
              </button>
            ) : null}
            <SiteAnalysisSummary siteAnalysis={siteAnalysis} />
            <p className="site-edit-hint">{activeSiteEditHint}</p>
          </section>

          <section className="control-card generation-controls">
            <h2>生成控制</h2>
            <GenerationControls
              parameters={project.parameters}
              seed={project.seed}
              canGenerate={canGenerate}
              isGenerating={isGeneratingImage}
              canExportPng={Boolean(aiImageUrl)}
              onParameterChange={updateParameter}
              onGenerate={() => void handleGenerate()}
              onExportPng={() => aiImageUrl && downloadImageDataUrl(aiImageUrl, filename)}
              onExportJson={() => downloadJson(exportJsonPayload, filename)}
            />
            {latestError ? <ErrorNotice error={latestError} /> : null}
          </section>
        </aside>

        <section className="site-stage" aria-label="右侧主窗口">
          <WorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'markup' ? (
            <SiteMarkupStage
              siteImage={project.siteImage}
              siteMarkup={siteMarkup}
              activeTool={activeTool}
              siteCanvasRef={siteCanvasRef}
              onUpload={handleSiteUpload}
              onCanvasClick={handleSiteCanvasClick}
              onCanvasKeyDown={handleSiteCanvasKeyDown}
            />
          ) : null}
          {activeTab === 'result' ? <GeneratedResultStage imageUrl={aiImageUrl} status={aiStatus} /> : null}
          {activeTab === 'explanation' ? <ExplanationStage explanation={explanation} siteAnalysis={siteAnalysis} status={status} /> : null}
        </section>
      </div>
    </section>
  );
}

function TopAppBar({ onExport, canExport }: { onExport: () => void; canExport: boolean }) {
  return (
    <header className="top-app-bar">
      <div className="app-brand">
        <div className="brand-mark" aria-hidden="true">
          <Building2 size={28} />
        </div>
        <div>
          <h1>苏式庭院景观概念方案生成器</h1>
          <p>场地解析、需求确认、园林规则、方案生成</p>
        </div>
      </div>
      <div className="top-actions">
        <button type="button">
          <ImagePlus size={16} aria-hidden="true" />
          示例
        </button>
        <button type="button">
          <CircleHelp size={16} aria-hidden="true" />
          帮助
        </button>
        <button type="button">
          <Save size={16} aria-hidden="true" />
          保存项目
        </button>
        <button type="button" onClick={onExport} disabled={!canExport}>
          <Upload size={16} aria-hidden="true" />
          导出
        </button>
        <button className="user-menu" type="button">
          <span aria-hidden="true" />
          园林设计师
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function ProcessStepper() {
  const steps = ['场地解析', '需求确认', '园林规则', '方案生成'];

  return (
    <nav className="stepper" aria-label="方案生成流程">
      {steps.map((step, index) => (
        <div className={index === steps.length - 1 ? 'step active' : 'step complete'} key={step}>
          <span>{index === steps.length - 1 ? index + 1 : <Check size={14} aria-hidden="true" />}</span>
          <strong>{step}</strong>
        </div>
      ))}
    </nav>
  );
}

function WorkspaceTabs({ activeTab, onTabChange }: { activeTab: WorkspaceTab; onTabChange: (tab: WorkspaceTab) => void }) {
  const tabs = [
    ['markup', '场地标注'],
    ['result', '生成方案'],
    ['explanation', '方案说明'],
  ] as const;

  return (
    <div className="workspace-tabs" role="tablist" aria-label="右侧主窗口标签">
      {tabs.map(([tab, label]) => (
        <button className={activeTab === tab ? 'active' : undefined} type="button" role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => onTabChange(tab)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function SiteImageUploader({
  siteImage,
  onUpload,
  onRemove,
}: {
  siteImage: GardenProject['siteImage'];
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  if (siteImage) {
    return (
      <div className="reference-file-row">
        <span>{siteImage.name}</span>
        <button type="button" onClick={onRemove}>
          <X size={16} aria-hidden="true" />
          移除
        </button>
      </div>
    );
  }

  return (
    <label className="upload-dropzone">
      <ImagePlus size={22} aria-hidden="true" />
      <span>上传场地图</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />
    </label>
  );
}

function SiteMarkupStage({
  siteImage,
  siteMarkup,
  activeTool,
  siteCanvasRef,
  onUpload,
  onCanvasClick,
  onCanvasKeyDown,
}: {
  siteImage: GardenProject['siteImage'];
  siteMarkup: SiteMarkup;
  activeTool: SiteMarkupTool;
  siteCanvasRef: RefObject<HTMLDivElement | null>;
  onUpload: (file: File | undefined) => void;
  onCanvasClick: (event: MouseEvent<HTMLDivElement>) => void;
  onCanvasKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  if (!siteImage) {
    return (
      <div className="empty-site-stage">
        <ImagePlus size={30} aria-hidden="true" />
        <label>
          上传场地图
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />
        </label>
      </div>
    );
  }

  return (
    <div
      ref={siteCanvasRef}
      className="site-canvas site-canvas-large"
      role="button"
      tabIndex={0}
      aria-label={`放大场地图标注：${activeToolLabel[activeTool]}`}
      onClick={onCanvasClick}
      onKeyDown={onCanvasKeyDown}
    >
      <img src={siteImage.url} alt="当前上传的场地图" />
      <SiteMarkupOverlay markup={siteMarkup} />
    </div>
  );
}

function GeneratedResultStage({ imageUrl, status }: { imageUrl: string | null; status: string }) {
  return (
    <section className="generated-result-stage" aria-label="生成方案结果">
      {imageUrl ? <img src={imageUrl} alt="AI 生成的苏式庭院方案图" /> : <p>{status}</p>}
    </section>
  );
}

function ExplanationStage({
  explanation,
  siteAnalysis,
  status,
}: {
  explanation: PlanExplanationSection[];
  siteAnalysis: SiteAnalysisData;
  status: string;
}) {
  return (
    <section className="explanation-stage" aria-label="方案说明">
      <p>{status}</p>
      <DataCard title="场地解析 JSON" data={siteAnalysis} />
      <div className="explanation-list">
        {explanation.map((item) => (
          <details open key={item.title}>
            <summary>
              <Layers size={17} aria-hidden="true" />
              {item.title}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <p>{item.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SiteAnalysisSummary({ siteAnalysis }: { siteAnalysis: SiteAnalysisData }) {
  const rows: Array<[keyof SiteAnalysisData, string]> = [
    ['siteBoundary', siteAnalysis.siteBoundary],
    ['buildingFootprint', siteAnalysis.buildingFootprint],
    ['mainEntrance', siteAnalysis.mainEntrance],
    ['mainViewSide', siteAnalysis.mainViewSide],
  ];

  return (
    <ul className="analysis-checklist" aria-label="场地解析完成项">
      {rows.map(([key, value]) => (
        <li key={key}>
          <Check size={14} aria-hidden="true" />
          <span>{siteAnalysisLabels[key]}</span>
          <strong>{value === '待确认' || value === '待标记' ? '待确认' : '已确认'}</strong>
        </li>
      ))}
    </ul>
  );
}

function GenerationControls({
  parameters,
  seed,
  canGenerate,
  isGenerating,
  canExportPng,
  onParameterChange,
  onGenerate,
  onExportPng,
  onExportJson,
}: {
  parameters: GardenParameters;
  seed: number;
  canGenerate: boolean;
  isGenerating: boolean;
  canExportPng: boolean;
  onParameterChange: <K extends keyof GardenParameters>(key: K, value: GardenParameters[K]) => void;
  onGenerate: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
}) {
  return (
    <div className="generation-stack">
      <Slider label="水景比例" value={parameters.waterRatio} onChange={(value) => onParameterChange('waterRatio', value)} />
      <SegmentedControl label="山石比例" value={parameters.rockDensity} onChange={(value) => onParameterChange('rockDensity', value)} />
      <SegmentedControl label="植物密度" value={parameters.plantingDensity} onChange={(value) => onParameterChange('plantingDensity', value)} />
      <ToggleRow label="视线箭头" checked />
      <ToggleRow label="标注" checked />
      <div className="seed-row">
        <span>随机种子</span>
        <strong>{seed}</strong>
        <button type="button" onClick={onGenerate} aria-label="刷新随机种子" disabled={!canGenerate || isGenerating}>
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>
      <button className="primary-action" type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating}>
        <WandSparkles size={18} aria-hidden="true" />
        {isGenerating ? '生成中' : '生成方案'}
      </button>
      <button type="button" onClick={onExportPng} disabled={!canExportPng}>
        <ImageDown size={18} aria-hidden="true" />
        导出 PNG
      </button>
      <button type="button" onClick={onExportJson}>
        <FileJson size={18} aria-hidden="true" />
        导出 JSON
      </button>
    </div>
  );
}

function SegmentedControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const options = [
    ['低', 28],
    ['中', 55],
    ['高', 82],
  ] as const;
  const activeLabel = value < 40 ? '低' : value > 70 ? '高' : '中';

  return (
    <div className="segmented-row">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map(([optionLabel, optionValue]) => (
          <button className={activeLabel === optionLabel ? 'active' : undefined} type="button" key={optionLabel} onClick={() => onChange(optionValue)}>
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button className={checked ? 'toggle active' : 'toggle'} type="button" aria-pressed={checked} aria-label={label}>
        <span />
      </button>
    </div>
  );
}

const activeToolLabel: Record<SiteMarkupTool, string> = {
  boundary: '绘制地块边界',
  buildingFootprint: '绘制建筑轮廓',
  mainEntrance: '标记主入口',
  mainViewSide: '标记景观方向',
};

const activeToolHint: Record<SiteMarkupTool, string> = {
  boundary: '在放大场地图上点击添加边界点，至少 3 个点可确认边界。',
  buildingFootprint: '在放大场地图上点击添加建筑轮廓点，至少 3 个点可确认轮廓。',
  mainEntrance: '在放大场地图上点击一次标记主入口位置。',
  mainViewSide: '在放大场地图上点击一次标记主要景观方向。',
};

const siteAnalysisLabels: Record<keyof SiteAnalysisData, string> = {
  siteBoundary: '地块边界',
  buildingFootprint: '建筑轮廓',
  mainEntrance: '主入口',
  mainViewSide: '景观方向',
  neighborInterface: '相邻界面',
  borrowedViewDirection: '借景方向',
  screeningRequired: '需遮挡方向',
};

const redrawActionLabel: Record<SiteMarkupTool, string> = {
  boundary: '擦除地块边界',
  buildingFootprint: '擦除建筑轮廓',
  mainEntrance: '重新标记主入口',
  mainViewSide: '重新标记景观方向',
};

function SiteMarkupOverlay({ markup }: { markup: SiteMarkup }) {
  return (
    <svg className="site-markup-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {markup.boundary.length >= 3 ? (
        <polygon points={pointsToAttribute(markup.boundary)} className="site-boundary-line" />
      ) : (
        <polyline points={pointsToAttribute(markup.boundary)} className="site-boundary-line" />
      )}
      {markup.buildingFootprint.length >= 3 ? (
        <polygon points={pointsToAttribute(markup.buildingFootprint)} className="site-building-line" />
      ) : (
        <polyline points={pointsToAttribute(markup.buildingFootprint)} className="site-building-line" />
      )}
      {markup.boundary.map((point, index) => (
        <circle key={`boundary-${index}`} cx={point.x} cy={point.y} r="1.4" className="site-boundary-dot" />
      ))}
      {markup.buildingFootprint.map((point, index) => (
        <rect key={`building-${index}`} x={point.x - 1.2} y={point.y - 1.2} width="2.4" height="2.4" className="site-building-dot" />
      ))}
      {markup.mainEntrance ? <circle cx={markup.mainEntrance.point.x} cy={markup.mainEntrance.point.y} r="2.4" className="site-entrance-dot" /> : null}
      {markup.mainViewSide ? (
        <path
          d={`M ${markup.mainViewSide.point.x - 3} ${markup.mainViewSide.point.y + 3} L ${markup.mainViewSide.point.x} ${
            markup.mainViewSide.point.y - 3
          } L ${markup.mainViewSide.point.x + 3} ${markup.mainViewSide.point.y + 3} Z`}
          className="site-view-dot"
        />
      ) : null}
    </svg>
  );
}

function getActiveToolHint(activeTool: SiteMarkupTool, siteMarkup: SiteMarkup) {
  if (activeTool === 'boundary' && siteMarkup.boundary.length >= 3) {
    return '在放大场地图上点击继续添加边界点，系统会自动闭合为地块多边形。';
  }
  if (activeTool === 'buildingFootprint' && siteMarkup.buildingFootprint.length >= 3) {
    return '在放大场地图上点击继续添加建筑轮廓点，系统会自动闭合为建筑多边形。';
  }
  return activeToolHint[activeTool];
}

export function getMapEraseAction(activeTool: SiteMarkupTool, siteMarkup: SiteMarkup): { tool: SiteMarkupTool; label: string } | null {
  if (activeTool === 'boundary' && siteMarkup.boundary.length > 0) {
    return { tool: 'boundary', label: redrawActionLabel.boundary };
  }
  if (activeTool === 'buildingFootprint' && siteMarkup.buildingFootprint.length > 0) {
    return { tool: 'buildingFootprint', label: redrawActionLabel.buildingFootprint };
  }
  if (activeTool === 'mainEntrance' && siteMarkup.mainEntrance) {
    return { tool: 'mainEntrance', label: redrawActionLabel.mainEntrance };
  }
  if (activeTool === 'mainViewSide' && siteMarkup.mainViewSide) {
    return { tool: 'mainViewSide', label: redrawActionLabel.mainViewSide };
  }
  return null;
}

function pointsToAttribute(points: SitePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function SiteToolButtons({
  activeTool,
  onToolChange,
  ariaLabel,
  className,
}: {
  activeTool: SiteMarkupTool;
  onToolChange: (tool: SiteMarkupTool) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={className ? `tool-grid ${className}` : 'tool-grid'} role="group" aria-label={ariaLabel}>
      <ToolButton icon={<Map size={17} aria-hidden="true" />} label="绘制地块边界" active={activeTool === 'boundary'} onClick={() => onToolChange('boundary')} />
      <ToolButton
        icon={<Building2 size={17} aria-hidden="true" />}
        label="绘制建筑轮廓"
        active={activeTool === 'buildingFootprint'}
        onClick={() => onToolChange('buildingFootprint')}
      />
      <ToolButton icon={<MousePointer2 size={17} aria-hidden="true" />} label="标记主入口" active={activeTool === 'mainEntrance'} onClick={() => onToolChange('mainEntrance')} />
      <ToolButton icon={<ScanLine size={17} aria-hidden="true" />} label="标记景观方向" active={activeTool === 'mainViewSide'} onClick={() => onToolChange('mainViewSide')} />
    </div>
  );
}

function ToolButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'tool-button active' : 'tool-button'} type="button" aria-pressed={active} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function DataCard({ title, data }: { title: string; data: SiteAnalysisData }) {
  const rows: Array<[keyof SiteAnalysisData, string]> = [
    ['siteBoundary', data.siteBoundary],
    ['buildingFootprint', data.buildingFootprint],
    ['mainEntrance', data.mainEntrance],
    ['mainViewSide', data.mainViewSide],
    ['neighborInterface', data.neighborInterface],
    ['borrowedViewDirection', data.borrowedViewDirection],
    ['screeningRequired', data.screeningRequired.join('、') || '待判断'],
  ];

  return (
    <article className="data-card">
      <h3>{title}</h3>
      <dl>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{siteAnalysisLabels[key]}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, onChange }: SliderProps) {
  return (
    <label className="slider-row">
      <span>
        {label}
        <strong>{value}%</strong>
      </span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
