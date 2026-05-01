import type { GardenElement, GardenPlan } from './gardenGenerator';

interface GardenPreviewProps {
  plan: GardenPlan;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function GardenPreview({ plan, svgRef }: GardenPreviewProps) {
  return (
    <svg
      ref={svgRef}
      className="garden-svg"
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      role="img"
      aria-label={`${plan.name}概念平面图`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="paper-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#ded8c8" strokeWidth="1" opacity="0.45" />
        </pattern>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#2d3428" floodOpacity="0.14" />
        </filter>
      </defs>
      <rect width={plan.width} height={plan.height} fill="#f7f4ec" />
      <rect width={plan.width} height={plan.height} fill="url(#paper-grid)" />
      {plan.elements.map((element) => (
        <GardenElementShape key={element.id} element={element} />
      ))}
    </svg>
  );
}

function GardenElementShape({ element }: { element: GardenElement }) {
  switch (element.kind) {
    case 'wall':
      return (
        <g>
          <rect
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rx="4"
            fill="#fbfaf6"
            stroke="#1f2b24"
            strokeWidth="8"
          />
          <rect
            x={element.x + 18}
            y={element.y + 18}
            width={(element.width ?? 0) - 36}
            height={(element.height ?? 0) - 36}
            fill="none"
            stroke="#b7b19f"
            strokeWidth="2"
            strokeDasharray="10 10"
          />
        </g>
      );
    case 'gate':
      return (
        <g filter="url(#soft-shadow)">
          <rect x={element.x} y={element.y} width={element.width} height={element.height} rx="17" fill="#1f2b24" />
          <circle cx={element.x + 24} cy={element.y + 17} r="17" fill="#f7f4ec" />
          <circle cx={element.x + (element.width ?? 0) - 24} cy={element.y + 17} r="17" fill="#f7f4ec" />
        </g>
      );
    case 'building':
      return (
        <g filter="url(#soft-shadow)">
          <rect x={element.x} y={element.y} width={element.width} height={element.height} rx="6" fill="#e9e1d0" stroke="#2f2920" strokeWidth="3" />
          <rect x={element.x - 12} y={element.y - 20} width={(element.width ?? 0) + 24} height="26" rx="4" fill="#7b2f2b" />
          <path
            d={`M ${element.x - 20} ${element.y - 18} L ${element.x + (element.width ?? 0) / 2} ${element.y - 42} L ${element.x + (element.width ?? 0) + 20} ${element.y - 18}`}
            fill="none"
            stroke="#7b2f2b"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {element.text && (
            <text x={element.x + (element.width ?? 0) / 2} y={element.y + (element.height ?? 0) / 2 + 8} textAnchor="middle" className="svg-label">
              {element.text}
            </text>
          )}
        </g>
      );
    case 'water':
      return (
        <g>
          <ellipse
            cx={element.x + (element.width ?? 0) / 2}
            cy={element.y + (element.height ?? 0) / 2}
            rx={(element.width ?? 0) / 2}
            ry={(element.height ?? 0) / 2}
            fill={element.variant === 'primary' ? '#a9d2dc' : '#bdd8dc'}
            stroke="#3f7f8a"
            strokeWidth="4"
          />
          <ellipse
            cx={element.x + (element.width ?? 0) / 2 - 20}
            cy={element.y + (element.height ?? 0) / 2 + 8}
            rx={(element.width ?? 0) * 0.32}
            ry={(element.height ?? 0) * 0.22}
            fill="none"
            stroke="#f2fbfb"
            strokeWidth="3"
            opacity="0.7"
          />
        </g>
      );
    case 'path':
      return (
        <polyline
          points={(element.points ?? []).map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="#b7a67a"
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 14"
        />
      );
    case 'bridge':
      return (
        <g transform={`rotate(${element.rotation ?? 0} ${element.x + (element.width ?? 0) / 2} ${element.y + (element.height ?? 0) / 2})`}>
          <rect x={element.x} y={element.y} width={element.width} height={element.height} rx="5" fill="#d8c59a" stroke="#6d624d" strokeWidth="3" />
          <line x1={element.x + 14} y1={element.y + 6} x2={element.x + (element.width ?? 0) - 14} y2={element.y + 6} stroke="#fff7df" strokeWidth="2" />
        </g>
      );
    case 'rock':
      return (
        <g transform={`rotate(${element.rotation ?? 0} ${element.x} ${element.y})`}>
          <path
            d={`M ${element.x - (element.width ?? 30) / 2} ${element.y + (element.height ?? 50) / 2}
              C ${element.x - (element.width ?? 30) * 0.8} ${element.y - 8}, ${element.x - 8} ${element.y - (element.height ?? 50) * 0.72}, ${element.x + (element.width ?? 30) * 0.24} ${element.y - (element.height ?? 50) * 0.5}
              C ${element.x + (element.width ?? 30) * 0.76} ${element.y - 8}, ${element.x + (element.width ?? 30) * 0.62} ${element.y + (element.height ?? 50) * 0.4}, ${element.x - (element.width ?? 30) / 2} ${element.y + (element.height ?? 50) / 2}`}
            fill="#8d8b80"
            stroke="#41433c"
            strokeWidth="3"
          />
          <circle cx={element.x + 4} cy={element.y - 6} r="4" fill="#5b5e55" opacity="0.55" />
        </g>
      );
    case 'plant':
      return <PlantSymbol element={element} />;
    case 'pavilion':
      return (
        <g filter="url(#soft-shadow)">
          <circle cx={element.x} cy={element.y} r={element.radius} fill="#efe5cb" stroke="#6b2e28" strokeWidth="4" />
          <path
            d={`M ${element.x - (element.radius ?? 42)} ${element.y - 8} L ${element.x} ${element.y - (element.radius ?? 42) - 18} L ${element.x + (element.radius ?? 42)} ${element.y - 8} Z`}
            fill="#8e3830"
          />
          {element.text && <text x={element.x} y={element.y + 10} textAnchor="middle" className="svg-label">{element.text}</text>}
        </g>
      );
    case 'label':
      return (
        <g>
          <rect x={element.x - 34} y={element.y - 18} width="68" height="28" rx="14" fill="#fffaf0" stroke="#b8a779" />
          <text x={element.x} y={element.y + 2} textAnchor="middle" className="svg-note">
            {element.text}
          </text>
        </g>
      );
    default:
      return null;
  }
}

function PlantSymbol({ element }: { element: GardenElement }) {
  const radius = element.radius ?? 22;
  const fill = {
    pine: '#2f654d',
    bamboo: '#6a8f3c',
    maple: '#b4573d',
    lotus: '#7a9f67',
  }[element.variant ?? 'pine'] ?? '#4f7b45';

  if (element.variant === 'bamboo') {
    return (
      <g>
        {[-10, 0, 10].map((offset) => (
          <line key={offset} x1={element.x + offset} y1={element.y + radius} x2={element.x + offset * 0.5} y2={element.y - radius} stroke={fill} strokeWidth="5" strokeLinecap="round" />
        ))}
      </g>
    );
  }

  if (element.variant === 'lotus') {
    return (
      <g>
        <circle cx={element.x} cy={element.y} r={radius * 0.64} fill="#d7e6d6" stroke="#6f955f" />
        <ellipse cx={element.x} cy={element.y - 2} rx={radius * 0.42} ry={radius * 0.2} fill="#e6a6b5" opacity="0.85" />
      </g>
    );
  }

  return (
    <g>
      <circle cx={element.x} cy={element.y} r={radius} fill={fill} opacity="0.92" />
      <circle cx={element.x - radius * 0.45} cy={element.y + radius * 0.1} r={radius * 0.56} fill={fill} opacity="0.72" />
      <circle cx={element.x + radius * 0.45} cy={element.y + radius * 0.16} r={radius * 0.48} fill={fill} opacity="0.78" />
    </g>
  );
}
