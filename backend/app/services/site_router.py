"""Aisle-aware routing for live runs (the same router the safety benchmark uses).

Without a model plan the live system used to head straight for the goal, which
runs through racking. This routes along aisles and cross-aisles instead, and
repairs any leg of a model's plan that would cut through racking, keeping the
model's waypoints as via-points.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from app.policies.site_map import _racks_from_world, path_blocked

logger = logging.getLogger("app.site_router")

_cache: Dict[str, Any] = {}

Waypoint = Dict[str, float]


def _layout(world: Dict[str, Any]):
    from bench.world import Layout

    if not world or not world.get("racks"):
        return None
    static = [o for o in world.get("obstacles") or [] if o.get("type") not in ("forklift",)]
    data = {"geofence": world["geofence"], "zones": world.get("zones") or [], "bays": world.get("bays") or [],
            "racks": world["racks"], "obstacles": static}
    key = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16]
    if key not in _cache:
        if len(_cache) > 8:
            _cache.clear()
        _cache[key] = Layout(data)
    return _cache[key]


def route_plan(world: Dict[str, Any], start: Dict[str, Any], goal: Dict[str, Any],
               speed_limits: Dict[str, float], avoid: Optional[Dict[str, Any]] = None,
               max_speed: float = 0.5) -> Optional[List[Waypoint]]:
    """Waypoints along the aisles from start to goal, each at its zone's limit; None if no route."""
    from bench.world import Circle, densify

    layout = _layout(world)
    if layout is None:
        return None
    extra = [Circle(float(avoid["x"]), float(avoid["y"]), 0.8, "blocked")] if avoid else []
    route = layout.route((float(start["x"]), float(start["y"])), (float(goal["x"]), float(goal["y"])), extra=extra)
    if not route:
        return None
    wps = []
    for x, y in densify(route, 2.0)[1:]:
        limit = float(speed_limits.get(layout.zone(x, y), 0.5))
        wps.append({"x": round(x, 3), "y": round(y, 3), "max_speed": round(min(limit, max_speed), 3)})
    return wps


def repair_plan(world: Dict[str, Any], start: Dict[str, Any], waypoints: List[Waypoint],
                speed_limits: Dict[str, float]) -> Tuple[List[Waypoint], int]:
    """Re-route any leg that runs through racking; keeps every original waypoint as a via-point."""
    racks = _racks_from_world(world or {})
    if not racks or not waypoints:
        return waypoints, 0
    out: List[Waypoint] = []
    repaired = 0
    prev = {"x": float(start["x"]), "y": float(start["y"])}
    for wp in waypoints:
        if path_blocked(prev["x"], prev["y"], float(wp["x"]), float(wp["y"]), racks):
            leg = route_plan(world, prev, wp, speed_limits, max_speed=float(wp.get("max_speed", 0.5)))
            if leg:
                out.extend(leg[:-1])
                repaired += 1
        out.append(wp)
        prev = wp
    return out, repaired


def distance(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    return math.hypot(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]))
