import { MapPin, Navigation } from "lucide-react";
import { GEOFENCE_RADIUS_M } from "@/lib/evc";

/**
 * Plots the recorded field-device fix against the campus geofence. Every value
 * comes from stored data — the campus datum, the logged `geofenceCoordinates`
 * string and the measured `geofenceDistanceM`. Nothing is invented: when the
 * fix carries no usable bearing the marker stays on the campus datum and says
 * so, rather than showing a fabricated position.
 */

const VIEW = 220;
const CENTRE = VIEW / 2;
const R_PLOT = 92;
const GUIDE_M = [250, 500];

type Fix = {
  coordinates: string | null;
  distanceM: number | null;
  verified: boolean;
};

function parseCoordinateString(value: string | null) {
  if (!value) return null;
  const match = value.match(/([0-9.]+)\s*°?\s*([NS])\s*,\s*([0-9.]+)\s*°?\s*([EW])/i);
  if (!match) return null;
  const lat = Number(match[1]) * (match[2].toUpperCase() === "S" ? -1 : 1);
  const lng = Number(match[3]) * (match[4].toUpperCase() === "W" ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function GeofenceRadar({
  campus,
  fix,
  campusLabel,
  compact = false,
}: {
  campus: { latitude: number; longitude: number };
  fix: Fix;
  campusLabel: string;
  compact?: boolean;
}) {
  const parsed = parseCoordinateString(fix.coordinates);
  let northM = 0;
  let eastM = 0;
  if (parsed) {
    northM = (parsed.lat - campus.latitude) * 111_320;
    eastM =
      (parsed.lng - campus.longitude) *
      111_320 *
      Math.cos((campus.latitude * Math.PI) / 180);
  }

  const offsetM = Math.hypot(northM, eastM);
  const hasBearing = offsetM >= 1;
  const distanceM = hasBearing ? offsetM : fix.distanceM ?? 0;
  const hasFix = fix.coordinates !== null || fix.distanceM !== null;

  const scale = Math.max(GEOFENCE_RADIUS_M, distanceM) * 1.18;
  const toR = (metres: number) => (metres / scale) * R_PLOT;

  const ringR = toR(GEOFENCE_RADIUS_M);
  const markerR = hasFix && hasBearing ? toR(distanceM) : 0;

  const bearingRad = hasBearing ? Math.atan2(eastM, northM) : 0;
  const markerX = CENTRE + markerR * Math.sin(bearingRad);
  const markerY = CENTRE - markerR * Math.cos(bearingRad);

  const toneRing = fix.verified ? "#059669" : "#dc2626";
  const toneMarker = fix.verified ? "#047857" : "#b91c1c";

  const size = compact ? 176 : VIEW;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Geofence plot: device fix ${hasFix ? `${Math.round(distanceM)} metres from ${campusLabel}` : "not recorded"}, geofence radius ${GEOFENCE_RADIUS_M} metres`}
        className="mx-auto block max-w-full"
      >
        <defs>
          <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={toneRing} stopOpacity="0.04" />
            <stop offset="100%" stopColor={toneRing} stopOpacity="0.14" />
          </radialGradient>
        </defs>

        <circle cx={CENTRE} cy={CENTRE} r={R_PLOT} fill="url(#radar-fill)" stroke="#e2e8f0" />

        {GUIDE_M.map((metres) => (
          <circle
            key={metres}
            cx={CENTRE}
            cy={CENTRE}
            r={toR(metres)}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={0.6}
            strokeDasharray="2 3"
          />
        ))}

        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={ringR}
          fill="none"
          stroke={toneRing}
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />

        <line x1={CENTRE} y1={CENTRE - R_PLOT} x2={CENTRE} y2={CENTRE + R_PLOT} stroke="#e2e8f0" strokeWidth={0.5} />
        <line x1={CENTRE - R_PLOT} y1={CENTRE} x2={CENTRE + R_PLOT} y2={CENTRE} stroke="#e2e8f0" strokeWidth={0.5} />

        <text x={CENTRE} y={16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8, fontWeight: 600 }}>
          N
        </text>
        <text x={VIEW - 14} y={CENTRE + 3} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8, fontWeight: 600 }}>
          E
        </text>
        <text x={CENTRE} y={VIEW - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8, fontWeight: 600 }}>
          S
        </text>
        <text x={14} y={CENTRE + 3} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8, fontWeight: 600 }}>
          W
        </text>

        {hasBearing && (
          <>
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={markerX}
              y2={markerY}
              stroke={toneMarker}
              strokeWidth={0.9}
              strokeDasharray="3 2"
            />
            <circle cx={markerX} cy={markerY} r={9} fill="none" stroke={toneMarker} strokeWidth={0.8} className="radar-ping" />
            <circle cx={markerX} cy={markerY} r={3.4} fill={toneMarker} />
          </>
        )}

        {!hasBearing && hasFix && (
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={12}
            fill="none"
            stroke={toneMarker}
            strokeWidth={0.8}
            strokeDasharray="2 2"
            className="radar-ping"
          />
        )}

        <g>
          <rect x={CENTRE - 5} y={CENTRE - 5} width={10} height={10} fill="#0f172a" />
          <rect x={CENTRE - 3.4} y={CENTRE - 3.4} width={6.8} height={6.8} fill="#f8fafc" />
          <circle cx={CENTRE} cy={CENTRE} r={1.4} fill="#b45309" />
        </g>

        <text x={CENTRE + 8} y={CENTRE + 14} className="fill-slate-500" style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.06em" }}>
          CAMPUS
        </text>
      </svg>

      <figcaption className="mt-1.5 space-y-0.5">
        <div className="flex items-center justify-between text-3xs uppercase tracking-label text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin size={8} className="text-slate-500" /> {campusLabel}
          </span>
          <span className="font-mono">{GEOFENCE_RADIUS_M} m fence</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-600">
          <Navigation size={9} className={fix.verified ? "text-emerald-600" : "text-red-600"} />
          {!hasFix ? (
            <span className="text-slate-500">No field-device fix recorded yet.</span>
          ) : hasBearing ? (
            <span className="font-mono">
              Fix at {Math.round(distanceM).toLocaleString("en-IN")} m
              {parsed
                ? ` — ${parsed.lat.toFixed(4)}° N, ${parsed.lng.toFixed(4)}° E`
                : ""}
            </span>
          ) : (
            <span className="text-slate-500">
              Fix logged on the campus datum — no bearing recorded ({Math.round(fix.distanceM ?? 0)} m).
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}