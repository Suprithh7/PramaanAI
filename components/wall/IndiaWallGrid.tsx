import type { RegionStat } from "@/lib/analytics";
import { REGION_META, type Region } from "@/lib/types";

const INDIA_PATH =
  "M150 30 L176 46 L196 34 L202 58 L214 64 L232 76 L248 88 L262 94 L256 104 L274 108 L266 122 L292 118 L318 96 L330 110 L318 132 L300 148 L292 166 L278 156 L268 172 L252 168 L246 188 L232 198 L226 222 L214 246 L210 272 L204 300 L196 332 L184 360 L176 374 L170 352 L158 328 L150 306 L138 292 L128 272 L114 256 L100 244 L82 236 L64 224 L48 230 L56 212 L78 200 L66 182 L82 162 L94 142 L110 130 L122 112 L132 92 L140 58 Z";

const HUB = { x: 176, y: 132 };

const NODES: Record<
  Region,
  { x: number; y: number; anchor: "start" | "end"; lx: number }
> = {
  NORTH: { x: 140, y: 88, anchor: "end", lx: -14 },
  CENTRAL: { x: 190, y: 216, anchor: "start", lx: 14 },
  WEST: { x: 100, y: 244, anchor: "end", lx: -14 },
  EAST: { x: 266, y: 180, anchor: "start", lx: 14 },
  SOUTH: { x: 180, y: 320, anchor: "start", lx: 14 },
};

const ARCS: Record<Region, string> = {
  NORTH: "M176 132 Q156 108 140 88",
  CENTRAL: "M176 132 Q196 174 190 216",
  WEST: "M176 132 Q140 172 100 244",
  EAST: "M176 132 Q232 168 266 180",
  SOUTH: "M176 132 Q232 240 180 320",
};

function toneFor(row: RegionStat | undefined) {
  if (!row || row.total === 0) return "#7f9ab2";
  if (row.breached > 0) return "#f87171";
  if (row.warning > 0) return "#fbbf24";
  return "#34d399";
}

function statusFor(row: RegionStat | undefined) {
  if (!row || row.total === 0) return "NO LIVE CASES";
  if (row.breached > 0) return `${row.breached} BREACH`;
  if (row.warning > 0) return `${row.warning} WARNING`;
  return "ON TRACK";
}

export function IndiaWallGrid({
  rows,
  totalActive,
}: {
  rows: RegionStat[];
  totalActive: number;
}) {
  const byRegion = new Map(rows.map((row) => [row.region, row]));

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-label text-navy-600">
        <span>22.00°N · 78.00°E</span>
        <span>WGS-84 · GRID 5R</span>
      </div>

      <svg
        viewBox="0 0 360 430"
        role="img"
        aria-label={`India operations grid: ${totalActive} active filings across five AICTE regions`}
        className="mx-auto h-auto w-full"
      >
        <defs>
          <linearGradient id="wall-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#143350" />
            <stop offset="0.55" stopColor="#0c2237" />
            <stop offset="1" stopColor="#071523" />
          </linearGradient>
          <pattern id="wall-stipple" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.65" fill="#9ab4ca" fillOpacity="0.3" />
          </pattern>
          <clipPath id="wall-clip">
            <path d={INDIA_PATH} />
          </clipPath>
          <linearGradient id="wall-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d2a941" stopOpacity="0.24" />
            <stop offset="1" stopColor="#d2a941" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g stroke="#97b0c7" strokeOpacity="0.05" strokeWidth="0.5">
          {[60, 120, 180, 240, 300].map((x) => (
            <line key={`x-${x}`} x1={x} y1="12" x2={x} y2="418" />
          ))}
          {[70, 140, 210, 280, 350].map((y) => (
            <line key={`y-${y}`} x1="10" y1={y} x2="350" y2={y} />
          ))}
        </g>

        <path
          d={INDIA_PATH}
          fill="none"
          stroke="#d2a941"
          strokeOpacity="0.08"
          strokeWidth="9"
          strokeLinejoin="round"
        />
        <path
          d={INDIA_PATH}
          fill="url(#wall-land)"
          stroke="#d2a941"
          strokeOpacity="0.62"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path d={INDIA_PATH} fill="url(#wall-stipple)" />

        <g clipPath="url(#wall-clip)" stroke="#9ab4ca" strokeOpacity="0.13" fill="none">
          <path d="M110 118 Q178 156 246 146" />
          <path d="M104 196 Q178 184 252 214" />
          <path d="M130 268 Q180 246 224 286" />
          <path d="M116 84 Q168 208 160 364" strokeDasharray="2 6" />
        </g>

        <g fill="#9ab4ca" fillOpacity="0.4">
          {[
            [316, 298],
            [320, 310],
            [324, 322],
            [327, 334],
            [148, 330],
            [153, 342],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" />
          ))}
        </g>

        <g className="wall-map-sweep">
          <path
            d="M176 132 L311.3 97.8 A140 140 0 0 1 310.1 170.9 Z"
            fill="url(#wall-sweep)"
          />
        </g>
        <g fill="none" stroke="#d2a941" strokeOpacity="0.09">
          <circle cx={HUB.x} cy={HUB.y} r="42" />
          <circle cx={HUB.x} cy={HUB.y} r="84" />
          <circle cx={HUB.x} cy={HUB.y} r="126" strokeDasharray="1 5" />
        </g>

        {(Object.keys(NODES) as Region[]).map((region, index) => {
          const node = NODES[region];
          const row = byRegion.get(region);
          const tone = toneFor(row);
          return (
            <g key={region}>
              <path
                d={ARCS[region]}
                fill="none"
                stroke="#97b0c7"
                strokeOpacity="0.22"
                strokeWidth="0.7"
                strokeDasharray="2 4"
                className="wall-map-arc"
              />
              <circle r="1.4" fill="#ddbf66" fillOpacity="0.9">
                <animateMotion
                  dur={`${6 + index * 1.3}s`}
                  repeatCount="indefinite"
                  path={ARCS[region]}
                />
              </circle>
            </g>
          );
        })}

        <g>
          <rect
            x={HUB.x - 8}
            y={HUB.y - 8}
            width="16"
            height="16"
            fill="none"
            stroke="#d2a941"
            strokeOpacity="0.55"
          />
          <rect x={HUB.x - 3.2} y={HUB.y - 3.2} width="6.4" height="6.4" fill="#ddbf66" />
          <line
            x1={HUB.x - 17}
            x2={HUB.x + 17}
            y1={HUB.y}
            y2={HUB.y}
            stroke="#d2a941"
            strokeOpacity="0.22"
          />
          <line
            x1={HUB.x}
            x2={HUB.x}
            y1={HUB.y - 17}
            y2={HUB.y + 17}
            stroke="#d2a941"
            strokeOpacity="0.22"
          />
          <text
            x={HUB.x}
            y={HUB.y + 24}
            textAnchor="middle"
            fontSize="6"
            letterSpacing="1.1"
            fill="#ddbf66"
            stroke="#081624"
            strokeWidth="2"
            paintOrder="stroke"
          >
            AICTE BUREAU
          </text>
        </g>

        {(Object.keys(NODES) as Region[]).map((region, index) => {
          const node = NODES[region];
          const row = byRegion.get(region);
          const meta = REGION_META[region];
          const tone = toneFor(row);
          const status = statusFor(row);
          return (
            <g key={region} transform={`translate(${node.x} ${node.y})`}>
              <title>
                {`${meta.label}: ${row?.total ?? 0} live, ${row?.breached ?? 0} breached`}
              </title>
              {(row?.breached ?? 0) > 0 && (
                <circle
                  r="7"
                  fill="none"
                  stroke={tone}
                  strokeWidth="1.1"
                  className="wall-node-pulse"
                  style={{ animationDelay: `${index * 0.45}s` }}
                />
              )}
              <line
                x1={node.lx > 0 ? 6 : -6}
                x2={node.lx}
                y1="0"
                y2="0"
                stroke={tone}
                strokeOpacity="0.55"
              />
              <rect
                x="-4.2"
                y="-4.2"
                width="8.4"
                height="8.4"
                transform="rotate(45)"
                fill={tone}
                stroke="#081624"
                strokeWidth="1"
              />
              <circle r="1.5" fill="#081624" />
              <g
                transform={`translate(${node.lx} 0)`}
                textAnchor={node.anchor}
                paintOrder="stroke"
                stroke="#081624"
                strokeWidth="2.4"
                strokeLinejoin="round"
              >
                <text y="-10" fontSize="6" letterSpacing="1.3" fill="#8ea9bf">
                  {meta.code} · {meta.hq.toUpperCase()}
                </text>
                <text y="4" fontSize="12" fontWeight="600" fill="#f4f7fa">
                  {row?.total ?? 0}
                  <tspan fontSize="6.5" letterSpacing="1" fill="#8ea9bf">
                    {" "}
                    LIVE
                  </tspan>
                </text>
                <text y="15" fontSize="6.2" letterSpacing="0.9" fill={tone}>
                  {status}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
