import { Building2, Download, FileJson, ImageDown, ImagePlus, Images, Map, MousePointer2, RefreshCw, ScanLine, WandSparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAiImageRequest, buildImagePrompt, normalizeUnknownGenerationError, requestAiImage, type AiImageMode } from '../aiImageClient';
import type { GardenProject, ImageGeneration } from '../domain/project';
import { downloadJson, downloadPng, downloadSvg } from '../exporters';
import { GardenPreview } from '../GardenPreview';
import { generateGardenPlan, type BuildingStyle, type FocalPoint, type GardenParameters } from '../gardenGenerator';
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

  const updateCustomPrompt = (customPrompt: string) => {
    onProjectChange({
      ...project,
      customPrompt,
      updatedAt: new Date().toISOString(),
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
    <>
      <aside className="control-panel" aria-label="参数控制面板">
        <div className="brand-block">
          <p className="eyebrow">Frontend MVP</p>
          <h1>苏式庭院景观概念方案生成器</h1>
          <p>用规则快速生成可导出的概念平面预览。</p>
        </div>

        <section className="control-section">
          <h2>空间参数</h2>
          <Slider label="庭院尺度" value={project.parameters.courtyardScale} onChange={(value) => updateParameter('courtyardScale', value)} />
          <Slider label="水体占比" value={project.parameters.waterRatio} onChange={(value) => updateParameter('waterRatio', value)} />
          <Slider label="叠石密度" value={project.parameters.rockDensity} onChange={(value) => updateParameter('rockDensity', value)} />
          <Slider label="植物密度" value={project.parameters.plantingDensity} onChange={(value) => updateParameter('plantingDensity', value)} />
          <Slider label="游线曲度" value={project.parameters.pathCurvature} onChange={(value) => updateParameter('pathCurvature', value)} />
        </section>

        <section className="control-section">
          <h2>风格设定</h2>
          <label className="field">
            <span>建筑气质</span>
            <select value={project.parameters.buildingStyle} onChange={(event) => updateParameter('buildingStyle', event.target.value as BuildingStyle)}>
              <option value="classic">典雅厅堂</option>
              <option value="compact">紧凑小筑</option>
              <option value="scholar">书斋园居</option>
            </select>
          </label>
          <label className="field">
            <span>核心景点</span>
            <select value={project.parameters.focalPoint} onChange={(event) => updateParameter('focalPoint', event.target.value as FocalPoint)}>
              <option value="pond">水院为核</option>
              <option value="rockery">叠山为核</option>
              <option value="pavilion">亭榭为核</option>
            </select>
          </label>
        </section>

        <section className="control-section">
          <h2>AI 提示词</h2>
          <label className="field">
            <span>内容 / 风格控制</span>
            <textarea value={project.customPrompt} onChange={(event) => updateCustomPrompt(event.target.value)} rows={7} />
          </label>
        </section>

        <section className="control-section">
          <h2>地块图</h2>
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
        </section>

        <section className="control-section">
          <h2>标记工具</h2>
          <SiteToolButtons activeTool={activeTool} onToolChange={setActiveTool} ariaLabel="侧栏地块图标记工具" />
          <button type="button" onClick={clearActiveMarkup}>
            <X size={16} aria-hidden="true" />
            {redrawActionLabel[activeTool]}
          </button>
        </section>

        {latestError ? <ErrorNotice error={latestError} /> : null}

        <div className="actions">
          <button className="primary-action" type="button" onClick={handleGenerate}>
            <RefreshCw size={18} aria-hidden="true" />
            生成方案
          </button>
          <button type="button" onClick={() => void handleAiGenerate('generate')} disabled={isGeneratingImage}>
            <WandSparkles size={18} aria-hidden="true" />
            生成 AI 图像
          </button>
          <button type="button" onClick={() => void handleAiGenerate('edit')} disabled={isGeneratingImage || !aiImageUrl}>
            <Images size={18} aria-hidden="true" />
            编辑当前图像
          </button>
          <button type="button" onClick={() => svgRef.current && downloadSvg(svgRef.current, filename)}>
            <Download size={18} aria-hidden="true" />
            导出 SVG
          </button>
          <button
            type="button"
            onClick={() => {
              if (svgRef.current) {
                void downloadPng(svgRef.current, filename);
              }
            }}
          >
            <ImageDown size={18} aria-hidden="true" />
            导出 PNG
          </button>
          <button type="button" onClick={() => downloadJson({ project, plan, siteAnalysis, requirementConfirmation, ruleExplanations: plan.ruleExplanations ?? [] }, filename)}>
            <FileJson size={18} aria-hidden="true" />
            导出 JSON
          </button>
        </div>
      </aside>

      <section className="preview-area" aria-label="苏式庭院概念平面预览">
        <header className="preview-header">
          <div>
            <p className="eyebrow">概念平面预览</p>
            <h2>{project.name}</h2>
          </div>
          <div className="plan-meta">
            <span>Seed {plan.seed}</span>
            <span>{status}</span>
          </div>
        </header>
        <div className="preview-canvas">
          <section className="site-markup-panel" aria-label="地块图标记工作区">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Site Markup</p>
                <h3>地块图标记</h3>
              </div>
              <span>{activeToolLabel[activeTool]}</span>
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
            ) : (
              <label className="site-placeholder">
                <ImagePlus size={34} aria-hidden="true" />
                <span>上传地块图后，可在图上绘制边界、建筑轮廓并标记入口与主观景面</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleSiteUpload(event.target.files?.[0])} />
              </label>
            )}
            <p className="site-edit-hint">{activeSiteEditHint}</p>
          </section>

          <section className="analysis-panel" aria-label="场地解析与需求确认">
            <DataCard title="场地解析数据" data={siteAnalysis} />
            <RequirementCard confirmation={requirementConfirmation} onChange={updateRequirement} />
          </section>

          <section className="ai-image-panel" aria-label="AI 图像结果">
            {aiImageUrl ? (
              <img src={aiImageUrl} alt={`${plan.name} AI 生成图`} />
            ) : (
              <div className="ai-placeholder">
                <WandSparkles size={34} aria-hidden="true" />
                <span>AI 图像未生成时，左侧规则方案仍可导出</span>
              </div>
            )}
            <div className="ai-panel-footer">
              <p>{aiStatus}</p>
            </div>
          </section>

          <section className="svg-baseline-panel" aria-label="规则方案基线预览">
            <GardenPreview plan={plan} svgRef={svgRef} />
          </section>
        </div>
        <footer className="summary-strip">
          {plan.summary.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </footer>
      </section>
    </>
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
