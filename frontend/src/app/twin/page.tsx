"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getTelemetry, getWorld, triggerScenario } from "@/lib/api";

const Warehouse3D = dynamic(() => import("@/components/twin/Warehouse3D"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading the 3D warehouse…</div>,
});

const SCENARIOS = [
  { key: "human_approach", label: "Worker steps out" },
  { key: "forklift_crossing", label: "Forklift crossing" },
  { key: "spill", label: "Spill" },
  { key: "path_blocked", label: "Dropped pallet" },
  { key: "clear", label: "Clear" },
];

/** Full-screen live digital twin of the simulated warehouse. */
export default function TwinPage() {
  const [world, setWorld] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q === "low") setQuality("low");
  }, []);

  useEffect(() => {
    let live = true;
    getWorld().then((w) => live && setWorld(w)).catch((e) => setErr(String(e?.message ?? e)));
    const id = setInterval(async () => {
      try {
        const t = await getTelemetry();
        if (live) setTelemetry(t);
      } catch (_) {}
    }, 200);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-slate-900/80">
        <Link href="/" className="text-xs text-slate-400 hover:text-white mr-1">← Dashboard</Link>
        <span className="text-sm font-bold text-white">MoveProof · live warehouse</span>
        <span className="text-xs text-slate-400 mr-auto">Every robot move here passes the safety gate before it happens.</span>
        {SCENARIOS.map((s) => (
          <button key={s.key} onClick={() => triggerScenario(s.key).catch(() => {})} className="px-2.5 py-1 text-xs rounded-md border border-white/15 text-slate-200 hover:bg-white/10">
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {err ? (
          <div className="h-full flex items-center justify-center text-red-300 text-sm">Simulator unavailable: {err}</div>
        ) : (
          <Warehouse3D world={world} telemetry={telemetry} className="h-full" quality={quality} />
        )}
      </div>
    </div>
  );
}
