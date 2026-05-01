import { Download, ImageDown, RefreshCw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { downloadPng, downloadSvg } from './exporters';
import { GardenPreview } from './GardenPreview';
import { generateGardenPlan, type BuildingStyle, type FocalPoint, type GardenParameters } from './gardenGenerator';
import './styles.css';

const initialParameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 38,
  rockDensity: 46,
  plantingDensity: 62,
  pathCurvature: 58,
  buildingStyle: 'classic',
  focalPoint: 'pond',
};

export default function App() {
  const [parameters, setParameters] = useState<GardenParameters>(initialParameters);
  const [seed, setSeed] = useState(20260501);
  const [status, setStatus] = useState('规则生成，未连接 AI 或后端');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const plan = useMemo(() => generateGardenPlan(parameters, seed), [parameters, seed]);

  const updateParameter = <K extends keyof GardenParameters>(key: K, value: GardenParameters[K]) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  const handleGenerate = () => {
    setSeed((current) => current + 1);
    setStatus('已生成新的概念方案');
  };

  const filename = `suzhou-garden-${plan.seed}`;

  return (
    <main className="app-shell">
      <aside className="control-panel" aria-label="参数控制面板">
        <div className="brand-block">
          <p className="eyebrow">Frontend MVP</p>
          <h1>苏式庭院景观概念方案生成器</h1>
          <p>用规则快速生成可导出的概念平面预览。</p>
        </div>

        <section className="control-section">
          <h2>空间参数</h2>
          <Slider label="庭院尺度" value={parameters.courtyardScale} onChange={(value) => updateParameter('courtyardScale', value)} />
          <Slider label="水体占比" value={parameters.waterRatio} onChange={(value) => updateParameter('waterRatio', value)} />
          <Slider label="叠石密度" value={parameters.rockDensity} onChange={(value) => updateParameter('rockDensity', value)} />
          <Slider label="植物密度" value={parameters.plantingDensity} onChange={(value) => updateParameter('plantingDensity', value)} />
          <Slider label="游线曲度" value={parameters.pathCurvature} onChange={(value) => updateParameter('pathCurvature', value)} />
        </section>

        <section className="control-section">
          <h2>风格设定</h2>
          <label className="field">
            <span>建筑气质</span>
            <select value={parameters.buildingStyle} onChange={(event) => updateParameter('buildingStyle', event.target.value as BuildingStyle)}>
              <option value="classic">典雅厅堂</option>
              <option value="compact">紧凑小筑</option>
              <option value="scholar">书斋园居</option>
            </select>
          </label>
          <label className="field">
            <span>核心景点</span>
            <select value={parameters.focalPoint} onChange={(event) => updateParameter('focalPoint', event.target.value as FocalPoint)}>
              <option value="pond">水院为核</option>
              <option value="rockery">叠山为核</option>
              <option value="pavilion">亭榭为核</option>
            </select>
          </label>
        </section>

        <div className="actions">
          <button className="primary-action" type="button" onClick={handleGenerate}>
            <RefreshCw size={18} aria-hidden="true" />
            生成方案
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
        </div>
      </aside>

      <section className="preview-area" aria-label="苏式庭院概念平面预览">
        <header className="preview-header">
          <div>
            <p className="eyebrow">概念平面预览</p>
            <h2>{plan.name}</h2>
          </div>
          <div className="plan-meta">
            <span>Seed {plan.seed}</span>
            <span>{status}</span>
          </div>
        </header>
        <div className="preview-canvas">
          <GardenPreview plan={plan} svgRef={svgRef} />
        </div>
        <footer className="summary-strip">
          {plan.summary.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </footer>
      </section>
    </main>
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
