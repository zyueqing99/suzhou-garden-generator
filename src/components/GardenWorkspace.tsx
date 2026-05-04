import {
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FileJson,
  ImageDown,
  ImagePlus,
  Layers,
  Map,
  Maximize2,
  MousePointer2,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAiImageRequest, buildImagePrompt, normalizeUnknownGenerationError, requestAiImage, type AiImageMode } from '../aiImageClient';
import type { GardenProject, ImageGeneration } from '../domain/project';
import { downloadJson, downloadPng, downloadSvg } from '../exporters';
import { GardenPreview } from '../GardenPreview';
import { generateGardenPlan, type GardenParameters } from '../gardenGenerator';
import { createRuleLayoutContext, hasUsableSiteContext } from '../ruleLayout';
import {
  resolveRequirementConfirmation,
  updateRequirementConfirmation,
  type RequirementConfirmation,
  type RequirementConfirmationKey,
} from '../requirementConfirmation';
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
import { ErrorNotice } from './ErrorNotice';

interface GardenWorkspaceProps {
  project: GardenProject;
  onProjectChange: (project: GardenProject) => void;
  onGenerationAdded: (generation: ImageGeneration) => void;
}

export function GardenWorkspace({ project, onProjectChange, onGenerationAdded }: GardenWorkspaceProps) {
  const [status, setStatus] = useState('规则方案已生成，可作为 AI 出图提示');
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null);
  const [aiStatus, setAiStatus] = useState('AI 图像尚未生成');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeTool, setActiveTool] = useState<SiteMarkupTool>('boundary');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const siteCanvasRef = useRef<HTMLDivElement | null>(null);
  const siteMarkup = project.siteMarkup ?? emptySiteMarkup;
  const siteAnalysis = useMemo(() => createSiteAnalysis(siteMarkup), [siteMarkup]);
  const requirementConfirmation = useMemo(
    () => resolveRequirementConfirmation(project.parameters, project.requirementConfirmation),
    [project.parameters, project.requirementConfirmation],
  );
  const ruleLayoutContext = useMemo(
    () => createRuleLayoutContext({ parameters: project.parameters, siteMarkup, siteAnalysis, requirementConfirmation }),
    [project.parameters, siteMarkup, siteAnalysis, requirementConfirmation],
  );
  const plan = useMemo(
    () => generateGardenPlan(project.parameters, project.seed, hasUsableSiteContext(ruleLayoutContext) ? ruleLayoutContext : undefined),
    [project.parameters, project.seed, ruleLayoutContext],
  );
  const latestError = project.generations.find((generation) => generation.status === 'failed' && generation.error)?.error;
  const mapEraseAction = getMapEraseAction(activeTool, siteMarkup);

  useEffect(() => {
    const latestImageUrl = project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null;
    setAiImageUrl(latestImageUrl);
    setAiStatus(latestImageUrl ? '正在展示已保存的 AI 图像' : 'AI 图像尚未生成');
    setStatus('规则方案已生成，可作为 AI 出图提示');
  }, [project.id, project.generations]);

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
  };

  const updateSiteMarkup = (siteMarkup: SiteMarkup) => {
    onProjectChange({
      ...project,
      siteMarkup,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateRequirement = (key: RequirementConfirmationKey, value: string) => {
    onProjectChange({
      ...project,
      requirementConfirmation: updateRequirementConfirmation(requirementConfirmation, key, value),
      updatedAt: new Date().toISOString(),
    });
  };
  const activeSiteEditHint = getActiveToolHint(activeTool, siteMarkup);

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

  const handleSiteCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
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

  const handleSiteCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    updateSiteMarkup(appendSiteMarkupPoint(siteMarkup, activeTool, { x: 50, y: 50 }));
  };

  const clearActiveMarkup = () => {
    updateSiteMarkup(clearSiteMarkupByTool(siteMarkup, activeTool));
  };

  const handleGenerate = () => {
    setAiImageUrl(null);
    setStatus('已生成新的规则概念方案');
    setAiStatus('AI 图像尚未生成');
    onProjectChange({
      ...project,
      seed: project.seed + 1,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAiGenerate = async (mode: AiImageMode) => {
    setIsGeneratingImage(true);
    setAiStatus(mode === 'edit' ? '正在编辑当前 AI 图像...' : project.siteImage ? '正在参考上传地块图生成图像...' : '正在调用 gpt-image-2 生成图像...');

    const basePrompt = buildImagePrompt(plan, project.parameters, project.customPrompt);
    const prompt =
      mode === 'edit'
        ? `${basePrompt}\nRefine the existing image while preserving the Suzhou garden concept and improving landscape readability.`
        : project.siteImage
          ? `${basePrompt}\nUse the uploaded site parcel image and the confirmed site analysis as drawing constraints.\nSite analysis JSON: ${JSON.stringify(siteAnalysis)}\nRequirement confirmation JSON: ${JSON.stringify(requirementConfirmation)}`
          : basePrompt;
    const request = buildAiImageRequest({
      mode,
      prompt,
      referenceImageUrl: project.siteImage?.url,
      currentImageUrl: aiImageUrl,
    });

    try {
      const result = await requestAiImage(request);
      setAiImageUrl(result.imageUrl);
      setStatus('右侧正在展示 gpt-image-2 图像结果');
      setAiStatus(mode === 'edit' ? 'AI 图像编辑完成' : project.siteImage ? '地块图约束生成完成' : 'AI 图像生成完成');
      onGenerationAdded({
        id: `generation-${Date.now()}`,
        projectId: project.id,
        createdAt: new Date().toISOString(),
        mode,
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
        mode,
        status: 'failed',
        prompt,
        provider: 'vectorengine',
        model: request.mode === 'edit' ? 'gpt-image-2-all' : 'gpt-image-2',
        error: generationError,
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const filename = `suzhou-garden-${plan.seed}`;

  return (
    <section className="workspace-shell" aria-label="第二版方案生成工作台">
      <TopAppBar
        onExport={() => {
          if (svgRef.current) {
            void downloadPng(svgRef.current, filename);
          }
        }}
      />
      <ProcessStepper />

      <div className="workspace-grid">
        <aside className="workspace-controls" aria-label="参数控制面板">
          <section className="control-card site-markup-panel" aria-label="地块图标记工作区">
            <div className="card-title-row">
              <div>
                <h2>场地解析</h2>
                <p>查看详情</p>
              </div>
              <ChevronDown size={16} aria-hidden="true" />
            </div>

            <div className="reference-uploader">
              {project.siteImage ? (
                <div className="reference-preview">
                  <img src={project.siteImage.url} alt="上传的地块图" />
                  <div>
                    <span>{project.siteImage.name}</span>
                    <button type="button" onClick={() => updateSiteImage(undefined)}>
                      <X size={16} aria-hidden="true" />
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <label className="upload-dropzone">
                  <ImagePlus size={22} aria-hidden="true" />
                  <span>上传地块图</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleSiteUpload(event.target.files?.[0])} />
                </label>
              )}
            </div>

            <SiteToolButtons activeTool={activeTool} onToolChange={setActiveTool} ariaLabel="画布地块图标记工具" className="site-tool-grid" />
            {mapEraseAction ? (
              <button className="site-erase-button" type="button" onClick={() => updateSiteMarkup(clearSiteMarkupByTool(siteMarkup, mapEraseAction.tool))}>
                <X size={16} aria-hidden="true" />
                {mapEraseAction.label}
              </button>
            ) : null}

            {project.siteImage ? (
              <div
                ref={siteCanvasRef}
                className="site-canvas"
                role="button"
                tabIndex={0}
                aria-label={`${activeToolLabel[activeTool]}，在地块图上点击添加标记点`}
                onClick={handleSiteCanvasClick}
                onKeyDown={handleSiteCanvasKeyDown}
              >
                <img src={project.siteImage.url} alt="当前上传的地块图" />
                <SiteMarkupOverlay markup={siteMarkup} />
              </div>
            ) : null}
            <SiteAnalysisSummary siteAnalysis={siteAnalysis} />
            <p className="site-edit-hint">{activeSiteEditHint}</p>
          </section>

          <section className="control-card analysis-panel" aria-label="场地解析与需求确认">
            <RequirementSummary confirmation={requirementConfirmation} />
            <DataCard title="场地解析数据" data={siteAnalysis} />
            <RequirementCard confirmation={requirementConfirmation} onChange={updateRequirement} />
          </section>

          <section className="control-card generation-controls">
            <h2>生成控制</h2>
            <GenerationControls
              parameters={project.parameters}
              seed={project.seed}
              activeTool={activeTool}
              onParameterChange={updateParameter}
              onToolChange={setActiveTool}
              onClearActiveMarkup={clearActiveMarkup}
              onGenerate={handleGenerate}
              onExportPng={() => {
                if (svgRef.current) {
                  void downloadPng(svgRef.current, filename);
                }
              }}
              onExportSvg={() => svgRef.current && downloadSvg(svgRef.current, filename)}
              onExportJson={() => downloadJson({ project, plan, siteAnalysis, requirementConfirmation, ruleExplanations: plan.ruleExplanations ?? [] }, filename)}
            />
            {latestError ? <ErrorNotice error={latestError} /> : null}
          </section>
        </aside>

        <section className="plan-stage" aria-label="苏式庭院概念平面预览">
          <header className="plan-stage-header">
            <div>
              <h2>方案预览</h2>
              <p>{project.name}</p>
            </div>
            <PlanToolbar />
          </header>

          <div className="plan-tabs" role="tablist" aria-label="方案视图">
            <button className="active" type="button">综合平面图</button>
            <button type="button">动线分析</button>
            <button type="button">视线分析</button>
            <button type="button">功能分区</button>
          </div>

          <section className="ai-image-panel" aria-label="AI 图像结果">
            <div className="view-toggle" role="group" aria-label="图像展示方式">
              <button className="active" type="button">SVG平面</button>
              <button type="button" aria-label="生成 AI 图像" onClick={() => void handleAiGenerate('generate')} disabled={isGeneratingImage}>
                AI展示图
              </button>
              <button type="button" onClick={() => void handleAiGenerate('edit')} disabled={isGeneratingImage || !aiImageUrl}>
                编辑当前图像
              </button>
            </div>
            <p>{aiStatus}</p>
          </section>

          <section className="plan-canvas svg-baseline-panel" aria-label="规则方案基线预览">
            <GardenPreview plan={plan} svgRef={svgRef} />
          </section>

          <footer className="canvas-status">
            <span>当前策略：入口障景 → 曲径入园 → 水院展开 → 茶庭收束</span>
            <span>已生成图层：边界 / 建筑 / 水体 / 路径 / 构筑物 / 植物 / 景墙 / 视线 / 标注</span>
            <button type="button" aria-label="图层">
              <Layers size={18} aria-hidden="true" />
            </button>
          </footer>
        </section>

        <ExplanationPanel planSummary={plan.summary} status={status} customPrompt={project.customPrompt} />
      </div>
    </section>
  );
}

function TopAppBar({ onExport }: { onExport: () => void }) {
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
        <button type="button" onClick={onExport}>
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
          <strong>{value === '待确认' ? '待确认' : '已确认'}</strong>
        </li>
      ))}
    </ul>
  );
}

function RequirementSummary({ confirmation }: { confirmation: RequirementConfirmation }) {
  const rows: Array<[string, string[]]> = [
    ['核心功能', [confirmation.functionalNeeds]],
    ['风格', [confirmation.stylePreference]],
    ['核心空间', [confirmation.waterRatio, confirmation.structureTypes]],
    ['主要元素', [confirmation.landscapeElements, confirmation.plantPreference]],
    ['私密性', ['高']],
  ];

  return (
    <div className="requirement-summary">
      <div className="card-title-row">
        <div>
          <h2>需求确认</h2>
          <p>查看详情</p>
        </div>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {rows.map(([label, values]) => (
        <div className="requirement-chip-row" key={label}>
          <span>{label}</span>
          <div>
            {values.map((value) => (
              <strong key={value}>{value}</strong>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GenerationControls({
  parameters,
  seed,
  activeTool,
  onParameterChange,
  onToolChange,
  onClearActiveMarkup,
  onGenerate,
  onExportPng,
  onExportSvg,
  onExportJson,
}: {
  parameters: GardenParameters;
  seed: number;
  activeTool: SiteMarkupTool;
  onParameterChange: <K extends keyof GardenParameters>(key: K, value: GardenParameters[K]) => void;
  onToolChange: (tool: SiteMarkupTool) => void;
  onClearActiveMarkup: () => void;
  onGenerate: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
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
        <button type="button" onClick={onGenerate} aria-label="刷新随机种子">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>
      <SiteToolButtons activeTool={activeTool} onToolChange={onToolChange} ariaLabel="辅助地块图标记工具" />
      <button type="button" onClick={onClearActiveMarkup}>
        <X size={16} aria-hidden="true" />
        {redrawActionLabel[activeTool]}
      </button>
      <button className="primary-action" type="button" onClick={onGenerate}>
        <WandSparkles size={18} aria-hidden="true" />
        生成方案
      </button>
      <button type="button" onClick={onExportPng}>
        <ImageDown size={18} aria-hidden="true" />
        导出 PNG
      </button>
      <button type="button" onClick={onExportSvg}>
        <Download size={18} aria-hidden="true" />
        导出 SVG
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

function PlanToolbar() {
  return (
    <div className="plan-toolbar" aria-label="画布工具">
      <button type="button">
        <Maximize2 size={16} aria-hidden="true" />
        适应画布
      </button>
      <button type="button">
        缩放 100%
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <button type="button">
        <RotateCcw size={16} aria-hidden="true" />
        重置
      </button>
    </div>
  );
}

function ExplanationPanel({ planSummary, status, customPrompt }: { planSummary: string[]; status: string; customPrompt: string }) {
  const explanations = [
    ['总体布局说明', status],
    ['功能分区说明', planSummary[0] ?? '以水院、茶庭与入口空间组织功能。'],
    ['动线说明', '入口障景、曲径入园、水院展开、月洞门过渡，形成层层递进的游赏节奏。'],
    ['景观节点说明', planSummary[1] ?? '以水面、叠石、亭榭、竹林和茶庭组织视线。'],
    ['苏州园林手法', '借景、对景、障景、框景和漏景综合运用，形成小中见大的园林体验。'],
    ['周边关系回应', '通过墙体、植物和水面组织边界，控制邻里视线并保留可借景方向。'],
    ['可落地性提醒', customPrompt],
  ];

  return (
    <aside className="explanation-panel" aria-label="方案解释">
      <h2>方案解释</h2>
      <div className="explanation-list">
        {explanations.map(([title, body], index) => (
          <details open={index === 0} key={title}>
            <summary>
              <Layers size={17} aria-hidden="true" />
              {title}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <p>{body}</p>
          </details>
        ))}
      </div>
      <OutputChecklist />
    </aside>
  );
}

function OutputChecklist() {
  const outputs = ['平面图（SVG）', '方案说明（PDF）', 'PNG 图片', 'SVG 文件', 'JSON 数据'];

  return (
    <section className="output-checklist" aria-label="输出内容">
      <h2>输出内容</h2>
      <ul>
        {outputs.map((item) => (
          <li key={item}>
            <Check size={15} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

const activeToolLabel: Record<SiteMarkupTool, string> = {
  boundary: '绘制地块边界',
  buildingFootprint: '绘制建筑轮廓',
  mainEntrance: '标记主入口',
  mainViewSide: '标记建筑主观景面',
};

const activeToolHint: Record<SiteMarkupTool, string> = {
  boundary: '在地块图上点击添加边界点，至少 3 个点可确认边界。',
  buildingFootprint: '在地块图上点击添加建筑轮廓点，至少 3 个点可确认轮廓。',
  mainEntrance: '在地块图上点击一次标记主入口位置。',
  mainViewSide: '在地块图上点击一次标记建筑主观景面。',
};

const redrawActionLabel: Record<SiteMarkupTool, string> = {
  boundary: '重新绘制地块边界',
  buildingFootprint: '重新绘制建筑轮廓',
  mainEntrance: '重新标记主入口',
  mainViewSide: '重新标记建筑主观景面',
};

const siteAnalysisLabels: Record<keyof SiteAnalysisData, string> = {
  siteBoundary: '地块边界',
  buildingFootprint: '建筑轮廓',
  mainEntrance: '主入口',
  mainViewSide: '建筑主观景面',
  neighborInterface: '相邻界面',
  borrowedViewDirection: '借景方向',
  screeningRequired: '需遮挡方向',
};

const requirementLabels: Record<RequirementConfirmationKey, string> = {
  functionalNeeds: '功能需求',
  stylePreference: '风格偏好',
  landscapeElements: '景观元素',
  waterRatio: '水景比例',
  rockRatio: '山石比例',
  structureTypes: '构筑物类型',
  plantPreference: '植物倾向',
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
    return '在地块图上点击继续添加边界点，系统会自动闭合为地块多边形。';
  }
  return activeToolHint[activeTool];
}

export function getMapEraseAction(activeTool: SiteMarkupTool, siteMarkup: SiteMarkup): { tool: SiteMarkupTool; label: string } | null {
  if (activeTool === 'boundary' && siteMarkup.boundary.length >= 3) {
    return { tool: 'boundary', label: '擦除地块边界' };
  }
  if (activeTool === 'buildingFootprint' && siteMarkup.buildingFootprint.length >= 3) {
    return { tool: 'buildingFootprint', label: '擦除建筑轮廓' };
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
      <ToolButton icon={<ScanLine size={17} aria-hidden="true" />} label="标记建筑主观景面" active={activeTool === 'mainViewSide'} onClick={() => onToolChange('mainViewSide')} />
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

function RequirementCard({
  confirmation,
  onChange,
}: {
  confirmation: RequirementConfirmation;
  onChange: (key: RequirementConfirmationKey, value: string) => void;
}) {
  return (
    <article className="data-card requirement-card">
      <h3>需求清单</h3>
      {Object.entries(requirementLabels).map(([key, label]) => (
        <label className="requirement-field" key={key}>
          <span>{label}</span>
          <input value={confirmation[key as RequirementConfirmationKey]} onChange={(event) => onChange(key as RequirementConfirmationKey, event.target.value)} />
        </label>
      ))}
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
