"use client";
/**
 * MoveProof live digital twin: a photoreal-styled 3D warehouse driven by the
 * simulator's world and telemetry, with the governance layer drawn into the
 * scene (planned route, people's safety zones, denied moves, the verdict).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Building } from "./Building";
import { Racking } from "./Racking";
import { Features, Forklift, Obstacle, Robot, VERDICT_COLOURS, Worker } from "./Actors";
import type { WorldLayout } from "./textures";

export type CameraMode = "overview" | "follow" | "robot";
type Pt = { x: number; y: number };
export type Detection = { label: string; conf: number; dist: number; box: [number, number, number, number]; kind: string };

export type TwinProps = {
  world: any | null;
  telemetry: any | null;
  verdict?: string | null; // APPROVED | NEEDS_REVIEW | DENIED
  verdictText?: string | null;
  proposal?: { intent?: string; params?: any } | null;
  planWaypoints?: Array<Pt & { max_speed?: number }> | null;
  executedPath?: Pt[];
  goal?: Pt | null;
  goalLabel?: string | null;
  mode?: CameraMode;
  onModeChange?: (m: CameraMode) => void;
  overlay?: boolean;
  className?: string;
  quality?: "high" | "low";
};

/* ───────────────────────── camera rigs ───────────────────────── */

function CameraRig({ mode, robot, center }: { mode: CameraMode; robot: React.MutableRefObject<{ x: number; y: number; theta: number }>; center: THREE.Vector3 }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3().copy(center));
  const pos = useRef(new THREE.Vector3());
  const snap = useRef(true);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = mode === "robot" ? 78 : mode === "follow" ? 55 : 42;
    cam.near = mode === "robot" ? 0.05 : 0.1;
    cam.updateProjectionMatrix();
    snap.current = true;
    if (mode === "overview") {
      cam.position.set(center.x + 9, 31, center.z + 24);
      cam.lookAt(center);
    }
  }, [mode, camera, center]);
  useFrame((_, dt) => {
    if (mode === "overview") return;
    const r = robot.current;
    const fx = Math.cos(r.theta), fz = -Math.sin(r.theta);
    const k = 1 - Math.exp(-(mode === "robot" ? 14 : 3.5) * Math.min(dt, 0.1));
    if (mode === "follow") {
      pos.current.set(r.x - fx * 4.2, 3.1, -r.y - fz * 4.2);
      look.current.lerp(new THREE.Vector3(r.x + fx * 3, 0.5, -r.y + fz * 3), snap.current ? 1 : k);
    } else {
      pos.current.set(r.x + fx * 0.37, 0.76, -r.y + fz * 0.37);
      look.current.set(r.x + fx * 6, 0.45, -r.y + fz * 6);
    }
    camera.position.lerp(pos.current, mode === "robot" || snap.current ? 1 : k);
    snap.current = false;
    camera.lookAt(look.current);
  });
  return null;
}

/** True when the sight line crosses racking (racks are taller than everything we detect). */
function blockedByRack(ax: number, ay: number, bx: number, by: number, racks: { x1: number; x2: number; y: number; depth?: number }[]) {
  for (const r of racks) {
    const x0 = r.x1 + 0.05, x1 = r.x2 - 0.05, y0 = r.y + 0.05, y1 = r.y + (r.depth ?? 1) - 0.05;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
      return true;
    };
    if (clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay) && t0 <= t1) return true;
  }
  return false;
}

/* ─────────────── robot-eye detections (projected to screen) ─────────────── */

function DetectionProbe({ active, items, onDetections, racks }: { racks: { x1: number; x2: number; y: number; depth?: number }[]; active: boolean; items: { kind: string; label: string; x: number; y: number; w: number; h: number; conf: number }[]; onDetections: (d: Detection[]) => void }) {
  const { camera, size } = useThree();
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (!active || clock.elapsedTime - last.current < 0.15) return;
    last.current = clock.elapsedTime;
    const out: Detection[] = [];
    const camPos = camera.position;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    for (const it of items) {
      const c = new THREE.Vector3(it.x, it.h / 2, -it.y);
      const rel = c.clone().sub(camPos);
      const dist = rel.length();
      if (dist > 16 || rel.dot(fwd) < 0.3) continue;
      if (blockedByRack(camPos.x, -camPos.z, it.x, it.y, racks)) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const dx of [-it.w / 2, it.w / 2])
        for (const dz of [-it.w / 2, it.w / 2])
          for (const yy of [0, it.h]) {
            const p = new THREE.Vector3(it.x + dx, yy, -it.y + dz).project(camera);
            const sx = ((p.x + 1) / 2) * size.width, sy = ((1 - p.y) / 2) * size.height;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          }
      if (x1 < 0 || y1 < 0 || x0 > size.width || y0 > size.height) continue;
      out.push({ kind: it.kind, label: it.label, conf: it.conf, dist, box: [Math.max(0, x0), Math.max(0, y0), Math.min(size.width, x1), Math.min(size.height, y1)] });
    }
    onDetections(out.sort((a, b) => a.dist - b.dist).slice(0, 6));
  });
  return null;
}

/* ───────────────────────── governance overlay ───────────────────────── */

function SafetyZones({ people, robot }: { people: Pt[]; robot: Pt }) {
  return (
    <group>
      {people.map((p, i) => {
        const d = Math.hypot(p.x - robot.x, p.y - robot.y);
        if (d > 9) return null;
        return (
          <group key={i} position={[p.x, 0.018, -p.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <circleGeometry args={[1.0, 48]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={d < 1.5 ? 0.32 : 0.16} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh>
              <ringGeometry args={[2.94, 3.0, 64]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh>
              <ringGeometry args={[0.97, 1.03, 48]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function GoalMarker({ goal, label }: { goal: Pt; label?: string | null }) {
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const s = 1 + 0.25 * ((clock.elapsedTime * 0.8) % 1);
    if (ring.current) {
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 - 0.8 * ((clock.elapsedTime * 0.8) % 1);
    }
  });
  return (
    <group position={[goal.x, 0.02, -goal.y]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.58, 48]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.95} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.66, 48]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <Html position={[0, 1.2, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div style={{ background: "rgba(6,78,59,.9)", color: "#d1fae5", font: "600 12px system-ui", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", border: "1px solid #10b981" }}>
          GOAL {label ?? ""}
        </div>
      </Html>
    </group>
  );
}

/* ───────────────────────────── scene ───────────────────────────── */

function Scene(props: TwinProps & { mode: CameraMode; onDetections: (d: Detection[]) => void; robotPose: React.MutableRefObject<{ x: number; y: number; theta: number }> }) {
  const { world, telemetry, verdict, verdictText, proposal, planWaypoints, executedPath, goal, goalLabel, mode, overlay = true, quality = "high" } = props;
  const layout: WorldLayout = world;
  const g = layout.geofence;
  const center = useMemo(() => new THREE.Vector3((g.min_x + g.max_x) / 2, 0, -(g.min_y + g.max_y) / 2), [g]);

  const rx = telemetry?.x ?? 3, ry = telemetry?.y ?? 3.5, rth = telemetry?.theta ?? 0;
  props.robotPose.current = { x: rx, y: ry, theta: rth };
  const obstacles: any[] = telemetry?.obstacles ?? world?.obstacles ?? [];
  const peopleRaw: any[] = telemetry?.walking_humans ?? world?.walking_humans ?? [];
  const people = useMemo(() => {
    const out = [...peopleRaw];
    const h = telemetry?.human;
    if (h && !out.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 0.2)) out.push({ ...h, name: h.name ?? "Worker" });
    return out;
  }, [peopleRaw, telemetry?.human]);
  const idle: any[] = telemetry?.idle_robots ?? world?.idle_robots ?? [];
  const forklifts = obstacles.filter((o) => o.type === "forklift");
  const statics = obstacles.filter((o) => o.type !== "forklift");
  const v = verdict ?? "IDLE";

  const ghostTarget = proposal?.intent === "MOVE_TO" && v !== "APPROVED" && proposal?.params && typeof proposal.params.x === "number" ? { x: proposal.params.x, y: proposal.params.y } : null;
  const nearestPerson = people.reduce((m: number, p: any) => Math.min(m, Math.hypot(p.x - rx, p.y - ry)), 999);

  const detItems = useMemo(() => [
    ...people.map((p: any) => ({ kind: "person", label: "person", x: p.x, y: p.y, w: 0.6, h: 1.8, conf: p.conf ?? 0.9 })),
    ...forklifts.map((f: any) => ({ kind: "forklift", label: "forklift", x: f.x, y: f.y, w: 2.2, h: 2.6, conf: 0.93 })),
    ...statics.filter((o: any) => ["spill", "dropped_pallet", "pallet", "tote_stack", "handcart"].includes(o.type)).map((o: any) => ({
      kind: o.type, label: o.type.replace("_", " "), x: o.x, y: o.y, w: Math.max(0.6, o.r * 2.4), h: o.type === "spill" ? 0.05 : o.type === "pallet" ? 1.25 : 0.9, conf: 0.88,
    })),
  ], [people, forklifts, statics]);

  return (
    <>
      <color attach="background" args={["#c9ced4"]} />
      <fog attach="fog" args={["#c4c9cf", 26, 85]} />
      <hemisphereLight args={["#ffffff", "#8b8a86", 0.55]} />
      <directionalLight
        position={[center.x + 6, 30, center.z + 8]}
        intensity={1.5}
        color="#fff6e8"
        castShadow
        shadow-mapSize={[quality === "high" ? 4096 : 2048, quality === "high" ? 4096 : 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        target-position={[center.x, 0, center.z]}
      />
      <Suspense fallback={null}>
        <WarehouseEnvironment />
      </Suspense>

      <Building world={layout} />
      <Racking racks={layout.racks} />
      <Features features={layout.features ?? []} />

      {statics.map((o, i) => (
        <Obstacle key={`${o.type}-${i}-${o.x}-${o.y}`} o={o} />
      ))}
      {forklifts.map((f, i) => (
        <Forklift key={`fl-${i}`} x={f.x} y={f.y} heading={f.heading ?? 0} />
      ))}
      {people.map((p: any, i: number) => (
        <Worker key={p.name ?? i} id={p.name ?? String(i)} x={p.x} y={p.y} highlight={overlay && Math.hypot(p.x - rx, p.y - ry) < 3} />
      ))}
      {idle.map((r: any, i: number) => (
        <Robot key={`idle-${i}`} x={r.x} y={r.y} theta={r.theta ?? 0} verdict="IDLE" idle />
      ))}
      <Robot x={rx} y={ry} theta={rth} verdict={v} />

      {overlay && (
        <group>
          {planWaypoints && planWaypoints.length > 0 && (
            <Line points={[[rx, 0.03, -ry], ...planWaypoints.map((w) => [w.x, 0.03, -w.y] as [number, number, number])]} color="#22d3ee" lineWidth={3.5} dashed dashSize={0.5} gapSize={0.3} transparent opacity={0.95} />
          )}
          {executedPath && executedPath.length > 1 && (
            <Line points={executedPath.map((p) => [p.x, 0.025, -p.y] as [number, number, number])} color="#22c55e" lineWidth={2.5} transparent opacity={0.6} />
          )}
          {goal && <GoalMarker goal={goal} label={goalLabel} />}
          <SafetyZones people={people} robot={{ x: rx, y: ry }} />
          {ghostTarget && (
            <>
              <Robot x={ghostTarget.x} y={ghostTarget.y} theta={Math.atan2(ghostTarget.y - ry, ghostTarget.x - rx)} verdict={v} ghost />
              <Line points={[[rx, 0.05, -ry], [ghostTarget.x, 0.05, -ghostTarget.y]]} color={VERDICT_COLOURS[v]} lineWidth={2} dashed dashSize={0.2} gapSize={0.15} />
            </>
          )}
          {mode !== "robot" && (
            <Html position={[rx, 1.55, -ry]} center distanceFactor={12} zIndexRange={[20, 0]}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "none" }}>
                <div style={{ background: VERDICT_COLOURS[v] ?? "#38bdf8", color: "#0b0b0b", font: "800 12px system-ui", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap", boxShadow: "0 2px 10px rgba(0,0,0,.35)" }}>
                  {v === "IDLE" ? "STANDBY" : v.replace("_", " ")}
                  {nearestPerson < 6 ? ` · person ${nearestPerson.toFixed(1)} m` : ""}
                </div>
                {verdictText && v !== "APPROVED" && v !== "IDLE" && (
                  <div style={{ background: "rgba(15,23,42,.88)", color: "#e2e8f0", font: "500 11px system-ui", padding: "2px 8px", borderRadius: 5, maxWidth: 260, textAlign: "center" }}>{verdictText}</div>
                )}
              </div>
            </Html>
          )}
        </group>
      )}

      <CameraRig mode={mode} robot={props.robotPose} center={center} />
      <DetectionProbe active={mode === "robot"} items={detItems} onDetections={props.onDetections} racks={layout.racks} />
      {mode === "overview" && <OrbitControls target={center} maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={70} enableDamping />}

      {quality === "high" ? (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.2} intensity={2.2} distanceFalloff={0.6} quality="medium" halfRes />
          <Bloom mipmapBlur luminanceThreshold={1.0} intensity={0.55} radius={0.6} />
          <SMAA />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      ) : null}
    </>
  );
}

function WarehouseEnvironment() {
  const [file, setFile] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    import("@pmndrs/assets/hdri/warehouse.exr").then((m) => ok && setFile(m.default)).catch(() => {});
    return () => {
      ok = false;
    };
  }, []);
  if (!file) return null;
  return <Environment files={file} environmentIntensity={0.55} />;
}

/* ───────────────────────────── shell ───────────────────────────── */

const MODES: { key: CameraMode; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "follow", label: "Follow" },
  { key: "robot", label: "Robot eye" },
];

const DET_COLOURS: Record<string, string> = { person: "#f97316", forklift: "#facc15", spill: "#38bdf8", dropped_pallet: "#f43f5e" };

export default function Warehouse3D(props: TwinProps) {
  const [modeLocal, setModeLocal] = useState<CameraMode>(() => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("cam") : null;
    return props.mode ?? (q === "follow" || q === "robot" ? q : "overview");
  });
  const mode = props.mode ?? modeLocal;
  const setMode = (m: CameraMode) => (props.onModeChange ? props.onModeChange(m) : setModeLocal(m));
  const [overlay, setOverlay] = useState(props.overlay ?? true);
  const [dets, setDets] = useState<Detection[]>([]);
  const robotPose = useRef({ x: 3, y: 3.5, theta: 0 });
  const v = props.verdict ?? "IDLE";

  if (!props.world?.racks) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 text-slate-400 text-sm ${props.className ?? ""}`} style={{ minHeight: 360 }}>
        Waiting for the warehouse simulator…
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900 ${props.className ?? ""}`} style={{ minHeight: 360 }}>
      <Canvas shadows dpr={props.quality === "low" ? 1 : [1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }} onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}>
        <PerspectiveCamera makeDefault position={[29, 31, 11.5]} fov={42} near={0.1} far={200} />
        <Scene {...props} mode={mode} overlay={overlay} onDetections={setDets} robotPose={robotPose} />
      </Canvas>

      {/* controls */}
      <div className="absolute top-3 left-3 flex gap-1 bg-slate-950/70 backdrop-blur rounded-lg p-1 border border-white/10">
        {MODES.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${mode === m.key ? "bg-cyan-500 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <button onClick={() => setOverlay(!overlay)} className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-950/70 backdrop-blur border border-white/10 text-slate-200 hover:bg-slate-800">
        {overlay ? "Governance layer: on" : "Governance layer: off"}
      </button>

      {/* robot-eye heads-up display */}
      {mode === "robot" && (
        <div className="pointer-events-none absolute inset-0">
          {dets.map((d, i) => (
            <div key={i} className="absolute" style={{ left: d.box[0], top: d.box[1], width: d.box[2] - d.box[0], height: Math.max(8, d.box[3] - d.box[1]), border: `2px solid ${DET_COLOURS[d.kind] ?? "#a3e635"}`, borderRadius: 3 }}>
              <span className="absolute -top-5 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-slate-950 whitespace-nowrap" style={{ background: DET_COLOURS[d.kind] ?? "#a3e635" }}>
                {d.label} {d.conf.toFixed(2)} · {d.dist.toFixed(1)} m
              </span>
            </div>
          ))}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="text-[10px] font-mono text-white/80 bg-black/50 px-2 py-1 rounded">CAM-FRONT · 78° · {props.telemetry?.speed?.toFixed?.(2) ?? "0.00"} m/s</div>
            <div className="text-xs font-extrabold px-3 py-1 rounded" style={{ background: VERDICT_COLOURS[v] ?? "#38bdf8", color: "#0b0b0b" }}>
              GATE: {v === "IDLE" ? "STANDBY" : v.replace("_", " ")}
            </div>
          </div>
          <div className="absolute top-12 left-3 text-[10px] font-mono text-red-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
          </div>
        </div>
      )}
    </div>
  );
}
