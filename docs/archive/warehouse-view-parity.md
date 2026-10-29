# Warehouse renderer parity

The live run page uses `WarehouseView` for both renderers. It supplies the same
world, telemetry, planned route, path preview, executed path, risk cells, safety
state, mission goal, destination bay, waypoint hover and fullscreen target.
The wrapper owns the telemetry trail so changing renderers does not clear it.

| Existing floor-plan capability | 3D equivalent |
| --- | --- |
| Live robot position, heading and speed | Interpolated robot and cameras, speed badge |
| Primary worker, walking workers, idle robots | Named actors; primary worker also falls back to world data |
| Geofence, racks, bays, features and hazards | Warehouse geometry, floor markings and geofence outline |
| Proposed path (blue) | Separate blue dashed path |
| Approved plan (purple), waypoint numbers and speed caps | Purple route; click a point or hover its planner entry to inspect |
| Executed path (green) | Separate green line |
| Telemetry trail toggle | Cyan trail with shared history |
| Proximity heatmap and governance risk cells | Instanced floor cells; same heatmap toggle and source data |
| OK, SLOW, STOP and REPLAN | State-colored safety ring and execution badge |
| Mission goal and destination bay | Goal marker, separate destination marker if different, target fallback |
| Planner waypoint hover | Highlight and tooltip for the corresponding 3D waypoint |
| Pan, zoom and minimap | Orbit/pan/zoom, camera footprint, click minimap to recenter |
| Fullscreen operator layout | Uses the same fullscreen grid reference |
| Mission editing, planning, execution, stop and operator controls | Remain in the shared run page, outside either renderer |
| Demo scenarios | Same scenario data with a 2D/3D switch |

There was no map-level playback implementation to port. Existing mission replay
and run-level controls remain shared; this change does not introduce a separate
3D execution path or replace policy enforcement.

## Verification

With the local frontend running and root Playwright dependencies installed:

```powershell
node tests/warehouse-parity.smoke.cjs
```

If Playwright's default Chromium is unavailable, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable. The test
uses API and WebSocket fixtures on the actual run page, rejects mutations,
and checks data wiring, switches, trail persistence, hover, minimap and fullscreen.
Hardware GPU throughput and physical safety are not benchmarked by this UI test.
