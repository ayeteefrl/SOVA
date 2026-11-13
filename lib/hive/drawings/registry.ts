import type { Drawing, ToolDef } from "./types";
import { BASE_PROPS } from "./types";
import { LINE_TOOLS } from "./tools/lines";
import { LINE_TOOLS_2 } from "./tools/lines2";
import { FIB_TOOLS } from "./tools/fib";
import { FIB_TOOLS_2 } from "./tools/fib2";
import { PATTERN_TOOLS } from "./tools/patterns";
import { FORECAST_TOOLS } from "./tools/forecast";
import { FORECAST_TOOLS_2 } from "./tools/forecast2";
import { SHAPE_TOOLS, ANNOTATION_TOOLS } from "./tools/shapes";
import { SHAPE_TOOLS_2 } from "./tools/shapes2";
import { ANNOTATION_TOOLS_2, ICON_TOOLS } from "./tools/annotation2";

const ALL = [...LINE_TOOLS, ...LINE_TOOLS_2, ...FIB_TOOLS, ...FIB_TOOLS_2, ...PATTERN_TOOLS, ...FORECAST_TOOLS, ...FORECAST_TOOLS_2, ...SHAPE_TOOLS, ...SHAPE_TOOLS_2, ...ANNOTATION_TOOLS, ...ANNOTATION_TOOLS_2, ...ICON_TOOLS];
const byId = Object.fromEntries(ALL.map((t) => [t.id, t]));

// TradingView's order inside each toolbar group.
const ORDER = [
  // trend line tools
  "trend_line", "ray", "info_line", "extended", "trend_angle", "horizontal_line", "horizontal_ray", "vertical_line", "cross_line",
  "parallel_channel", "regression_trend", "flat_top_bottom", "disjoint_channel",
  "pitchfork", "schiff_pitchfork", "modified_schiff_pitchfork", "inside_pitchfork",
  // gann and fibonacci
  "fib_retracement", "trend_fib_extension", "fib_channel", "fib_time_zone", "fib_speed_fan", "trend_fib_time", "fib_circles",
  "fib_spiral", "fib_speed_arcs", "fib_wedge", "pitchfan", "gann_box", "gann_square_fixed", "gann_square", "gann_fan",
  // patterns
  "xabcd", "cypher", "head_shoulders", "abcd", "triangle_pattern", "three_drives",
  "elliott_impulse", "elliott_correction", "elliott_triangle", "elliott_double_combo", "elliott_triple_combo",
  "cyclic_lines", "time_cycles", "sine_line",
  // forecasting and measurement
  "long_position", "short_position", "position_forecast", "bars_pattern", "ghost_feed", "sector",
  "anchored_vwap", "fixed_range_vp", "anchored_vp", "price_range", "date_range", "date_price_range",
  // shapes
  "brush", "highlighter", "arrow_marker", "arrow", "arrow_mark_up", "arrow_mark_down", "rectangle", "rotated_rectangle",
  "path", "circle", "ellipse", "polyline", "triangle", "arc", "curve", "double_curve",
  // annotation
  "text", "note", "price_note", "pin", "table", "callout", "comment", "price_label", "signpost", "flag_mark", "image",
];

export const TOOLS: ToolDef[] = [...ORDER.map((id) => byId[id]).filter(Boolean), ...ALL.filter((t) => !ORDER.includes(t.id))];
export const TOOL_BY_ID: Record<string, ToolDef> = byId;

let seq = 0;
export const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newDrawing(tool: string, points: Drawing["points"], overrides: Partial<Drawing["props"]> = {}): Drawing {
  const def = TOOL_BY_ID[tool];
  return {
    id: newId(),
    tool,
    points,
    props: { ...BASE_PROPS, ...(def?.defaults || {}), ...overrides, levels: (overrides.levels || def?.defaults?.levels || []).map((l) => ({ ...l })) },
  };
}
