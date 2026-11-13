// A drawing is anchored to {time, price} points, so it stays put when you change timeframe and can
// sit in the future, past the last bar. Every tool is a ToolDef in the registry (tools/*.ts).

export type Pt = { time: number; price: number };
export type XY = { x: number; y: number };

export type Level = { value: number; color: string; visible: boolean };

export type DrawingProps = {
  color: string;
  width: number;
  style: 0 | 1 | 2; // solid, dashed, dotted
  fill: boolean;
  fillColor: string;
  text: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  showPrice: boolean;
  showLabels: boolean;
  levels: Level[];
  // Long/short position
  stopColor: string;
  targetColor: string;
  // Anything else a tool wants to keep
  [k: string]: unknown;
};

export type Drawing = {
  id: string;
  tool: string;
  points: Pt[];
  props: DrawingProps;
  locked?: boolean;
  hidden?: boolean;
  // Hide on some timeframes, like TradingView's Visibility tab. Empty = show everywhere.
  hideOn?: string[];
};

export type ChartBar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type RenderCtx = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  toXY: (p: Pt) => XY | null;
  toPt: (xy: XY) => Pt | null;
  fmtPrice: (v: number) => string;
  fmtTime: (t: number) => string;
  barsBetween: (t1: number, t2: number) => number;
  volumeBetween: (t1: number, t2: number) => number | null;
  // Bar access for tools that read prices (regression, anchored VWAP, volume profiles, ghost feed).
  bars: ChartBar[];
  indexOf: (t: number) => number | null; // fractional bar index of a time
  timeAt: (index: number) => number | null; // time of a (fractional) bar index, past the last bar too
  xAt: (index: number) => number | null;
  yAt: (price: number) => number | null;
  priceAt: (y: number) => number | null;
  active: boolean;
};

export type SettingField =
  | { key: string; label: string; type: "color" | "bool" | "text" | "textarea" }
  | { key: string; label: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "select"; options: { value: string | number; label: string }[] }
  | { key: "levels"; label: string; type: "levels" }
  | { key: string; label: string; type: "image" };

export type ToolDef = {
  id: string;
  name: string;
  group: ToolGroup;
  icon: string; // SVG inner markup on a 28x28 box
  // Anchors to place: N clicks; 0 = freehand (press and drag, like the brush);
  // -1 = as many clicks as you like, double-click or Enter to finish (path, polyline).
  points: number;
  // Shown on the toolbar flyout but built from other tools' parts (for grouping).
  hidden?: boolean;
  hotkey?: string;
  defaults?: Partial<DrawingProps>;
  draw: (c: RenderCtx, pts: XY[], d: Drawing) => void;
  // Pixel distance from (x, y) to the drawing, for selecting. Default: segments between anchors.
  hit?: (c: RenderCtx, pts: XY[], d: Drawing, x: number, y: number) => number;
  // Extra fields on the Style tab, after line colour/width/style.
  fields?: SettingField[];
  // Text tools open the text editor as soon as they're placed.
  editsText?: boolean;
  // Tools placed with fewer clicks than they have anchors (long/short position) build the rest here.
  init?: (first: Pt, barSeconds: number) => Pt[];
  // Keep anchors consistent after anchor `moved` was dragged (e.g. target and stop share an edge).
  constrain?: (points: Pt[], moved: number) => Pt[];
};

export type ToolGroup = "cursors" | "lines" | "fib" | "patterns" | "forecast" | "shapes" | "annotation" | "icons";

export const GROUPS: { id: ToolGroup; name: string }[] = [
  { id: "cursors", name: "Cursors" },
  { id: "lines", name: "Trend line tools" },
  { id: "fib", name: "Gann and Fibonacci tools" },
  { id: "patterns", name: "Patterns" },
  { id: "forecast", name: "Forecasting and measurement tools" },
  { id: "shapes", name: "Geometric shapes" },
  { id: "annotation", name: "Annotation tools" },
  { id: "icons", name: "Icons" },
];

// Pointer modes in the cursor group. They select and move drawings like the cross;
// the eraser removes whatever you click.
export const CURSORS = [
  { id: "cursor", name: "Cross", css: "crosshair", icon: '<path d="M14 5v18M5 14h18"/>' },
  { id: "dot", name: "Dot", css: "crosshair", icon: '<circle cx="14" cy="14" r="3" fill="currentColor"/>' },
  { id: "arrow", name: "Arrow", css: "default", icon: '<path d="M8 5l13 8-6 1.5L12 21z"/>' },
  { id: "demonstration", name: "Demonstration", css: "crosshair", icon: '<circle cx="14" cy="14" r="6"/><circle cx="14" cy="14" r="2" fill="currentColor"/>' },
  { id: "eraser", name: "Eraser", css: "cell", icon: '<path d="M6 18l8-10 8 6-6 7H9z"/><path d="M11 21h12"/>' },
];
export const isPointer = (tool: string) => CURSORS.some((c) => c.id === tool);

export const BASE_PROPS: DrawingProps = {
  color: "#2962ff",
  width: 2,
  style: 0,
  fill: false,
  fillColor: "rgba(41,98,255,0.2)",
  text: "",
  textColor: "#2962ff",
  fontSize: 14,
  bold: false,
  italic: false,
  extendLeft: false,
  extendRight: false,
  showPrice: true,
  showLabels: true,
  levels: [],
  stopColor: "rgba(242,54,69,0.25)",
  targetColor: "rgba(8,153,129,0.25)",
};
