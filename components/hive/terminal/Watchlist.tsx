"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, digitsFor, fmtPct, fmtPrice, stream, ticker, type Quote } from "@/lib/hive/data";
import { newUid, setState, useStore, type WatchList, type WatchSection } from "@/lib/hive/store";
import { Icon, Popover } from "../ui";

// Live ticks are batched and shown at most this often, so the numbers stay readable.
const REFRESH_MS = 2000;

export default function Watchlist({ onAdd }: { onAdd: (section: number) => void }) {
  const lists = useStore((s) => s.lists);
  const activeId = useStore((s) => s.activeList);
  const list = lists.find((l) => l.id === activeId) ?? lists[0];
  const sections = list.sections;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renamingSec, setRenamingSec] = useState<number | null>(null);
  const [confirmSec, setConfirmSec] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; x: number; y: number } | null>(null);
  const current = useStore((s) => s.symbol);
  const all = useMemo(() => [...new Set(sections.flatMap((s) => s.symbols))], [sections]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);

  // Everything inside is sized in em, so the whole panel scales with its width.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const font = Math.max(10, Math.min(17, width * 0.0433));
  const saved = useStore((s) => s.watchCols);
  const vis = saved;
  const colList = (["symbol", "last", "chg", "chgPct"] as const).filter((k) => vis[k]);
  // One shared grid for the header and every row (rows use subgrid), so each number column is as wide
  // as its widest value and the header, prices, changes and percentages line up exactly.
  const cols = colList.map((_, i) => (i === 0 ? "minmax(0,1fr)" : "auto")).join(" ");
  const toggleCol = (k: keyof typeof vis) => {
    if (vis[k] && colList.length === 1) return; // always keep one column
    setState((s) => ({ watchCols: { ...vis, ...s.watchCols, [k]: !vis[k] } }));
  };
  // Sorting is per divider section: ascending -> descending -> back to your own order.
  const sort = list.sort ?? null; // each watchlist keeps its own sort
  const HEAD = [
    ["symbol", "Symbol", false],
    ["last", "Last", true],
    ["chg", "Chg", true],
    ["chgPct", "Chg%", true],
  ] as const;
  const cycleSort = (k: "symbol" | "last" | "chg" | "chgPct") =>
    editList(list.id, (l) => ({ ...l, sort: sort?.key !== k ? { key: k, dir: "asc" } : sort.dir === "asc" ? { key: k, dir: "desc" } : null }));
  const rowsOf = (syms: string[]) => {
    const rows = syms.map((sym, yi) => ({ sym, yi }));
    if (!sort) return rows;
    const val = (s: string): string | number | null | undefined => {
      const q = quotes[s];
      return sort.key === "symbol" ? ticker(s) : sort.key === "last" ? q?.price : sort.key === "chg" ? q?.change : q?.changePct;
    };
    const m = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const x = val(a.sym);
      const y = val(b.sym);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // no data always last
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * m;
    });
  };

  // Drag a symbol up, down, or into another divider section (custom order only).
  const [drag, setDrag] = useState<{ si: number; sym: string } | null>(null);
  const [over, setOver] = useState<{ si: number; at: number } | null>(null); // insert before index `at` of section `si`
  const dropAt = (si: number, at: number) => {
    const from = drag;
    setDrag(null);
    setOver(null);
    if (!from) return;
    editSections((secs) => {
      const src = secs[from.si]?.symbols.indexOf(from.sym) ?? -1;
      if (src < 0) return secs;
      const next = secs.map((w) => ({ ...w, symbols: [...w.symbols] }));
      next[from.si].symbols.splice(src, 1);
      next[si].symbols.splice(from.si === si && src < at ? at - 1 : at, 0, from.sym);
      return next;
    });
  };
  const COLS = [
    ["symbol", "Symbol"],
    ["last", "Last"],
    ["chg", "Change"],
    ["chgPct", "Change %"],
  ] as const;

  useEffect(() => {
    let alive = true;
    const pending: Record<string, Quote> = {};
    api
      .quotes(all)
      .then((q) => alive && setQuotes((old) => ({ ...q, ...old })))
      .catch(() => {});
    const unwatch = stream.watchQuotes(all);
    const off = stream.onQuote((s, q) => {
      pending[s] = q;
    });
    const timer = setInterval(() => {
      if (!Object.keys(pending).length) return;
      const batch = { ...pending };
      for (const k of Object.keys(pending)) delete pending[k];
      setQuotes((old) => ({ ...old, ...batch }));
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      unwatch();
      off();
    };
  }, [all]);

  const editList = (id: string, fn: (l: WatchList) => WatchList) => setState((s) => ({ lists: s.lists.map((l) => (l.id === id ? fn(l) : l)) }));
  const editSections = (fn: (secs: WatchSection[]) => WatchSection[]) => editList(list.id, (l) => ({ ...l, sections: fn(l.sections) }));
  const remove = (sec: number, sym: string) => editSections((secs) => secs.map((w, i) => (i === sec ? { ...w, symbols: w.symbols.filter((x) => x !== sym) } : w)));

  // Dividers: a divider is just a named section. A section with no name shows no header.
  const addDivider = () => {
    editSections((secs) => [...secs, { name: "New section", symbols: [] }]);
    setRenamingSec(sections.length);
  };
  const splitAt = (si: number, at: number) => {
    editSections((secs) => secs.flatMap((w, i) => (i === si ? [{ ...w, symbols: w.symbols.slice(0, at) }, { name: "New section", symbols: w.symbols.slice(at) }] : [w])));
    setRenamingSec(si + 1);
  };
  const removeDivider = (si: number, withSymbols = false) =>
    editSections((secs) => {
      if (withSymbols) return secs.length === 1 ? [{ name: "", symbols: [] }] : secs.filter((_, i) => i !== si);
      if (secs.length === 1) return [{ ...secs[0], name: "" }];
      const moved = secs[si].symbols;
      const into = si > 0 ? si - 1 : 1;
      return secs.map((w, i) => (i === into ? { ...w, symbols: si > 0 ? [...w.symbols, ...moved] : [...moved, ...w.symbols] } : w)).filter((_, i) => i !== si);
    });
  const removeAllDividers = () => editSections((secs) => [{ name: "", symbols: secs.flatMap((w) => w.symbols) }]);

  const addList = () => {
    const id = newUid();
    setState((s) => ({ lists: [...s.lists, { id, name: `Watchlist ${s.lists.length + 1}`, sections: [{ name: "", symbols: [] }] }], activeList: id }));
    setRenaming(id);
  };
  // Asks right under the watchlist name, so nothing else on the page is blocked.
  const askDelete = (l: WatchList) => {
    if (lists.length < 2) return;
    const r = document.querySelector("[data-header]")?.getBoundingClientRect();
    setConfirmDel({ id: l.id, x: Math.max(8, Math.min((r?.left ?? 40) - 8, window.innerWidth - 232)), y: (r?.bottom ?? 48) + 6 });
  };
  const deleteList = (id: string) => {
    setConfirmDel(null);
    setState((s) => {
      if (s.lists.length < 2) return {};
      const left = s.lists.filter((x) => x.id !== id);
      return { lists: left, activeList: s.activeList === id ? left[0].id : s.activeList };
    });
  };
  useEffect(() => {
    if (!confirmDel) return;
    const off = (e: Event) => !(e.target as HTMLElement).closest?.("[data-confirm]") && setConfirmDel(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setConfirmDel(null);
    window.addEventListener("mousedown", off);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", off);
      window.removeEventListener("keydown", esc);
    };
  }, [confirmDel]);
  const doomed = lists.find((l) => l.id === confirmDel?.id);

  return (
    <div ref={root} className="flex h-full flex-col" style={{ fontSize: font }}>
      {confirmDel && doomed && (
        <div data-confirm className="menu fixed z-50 w-56 p-3 text-[13px] normal-case" style={{ left: confirmDel.x, top: confirmDel.y, fontSize: 13 }}>
          <div className="mb-2">
            Delete <b>{doomed.name}</b>?
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn h-7" onClick={() => setConfirmDel(null)}>
              Cancel
            </button>
            <button autoFocus className="btn h-7 bg-hive-down px-3 text-white hover:bg-hive-down/90" onClick={() => deleteList(doomed.id)}>
              Delete
            </button>
          </div>
        </div>
      )}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-hive-line px-2">
        <div className="flex min-w-0 flex-1 items-center">
          {renaming === list.id ? (
            <input
              autoFocus
              className="input h-8 w-full max-w-[14em]"
              defaultValue={list.name}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => (editList(list.id, (x) => ({ ...x, name: e.target.value.trim() || x.name })), setRenaming(null))}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <Popover
              className="min-w-0 max-w-full"
              button={(_, toggle) => (
                <button data-header className="flex h-8 max-w-full items-center gap-1.5 rounded px-2 font-semibold hover:bg-hive-hover" title="Switch watchlist (double-click to rename)" onClick={toggle} onDoubleClick={() => setRenaming(list.id)}>
                  <span className="truncate">{list.name}</span>
                  {lists.length > 1 && <span className="rounded-full bg-hive-hover px-1.5 text-2xs font-medium text-hive-muted">{lists.length}</span>}
                  <Icon name="chevronDown" size={14} className="shrink-0 text-hive-muted" />
                </button>
              )}
            >
              {(close) => (
                <div className="w-64 max-w-[calc(100vw-24px)] py-1 text-[13px]">
                  {lists.map((l) => (
                    <div key={l.id} className={`menu-item group/row pr-2 ${l.id === list.id ? "text-hive-accent" : ""}`}>
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => {
                          setState({ activeList: l.id });
                          close();
                        }}
                      >
                        <span className="truncate">{l.name}</span>
                        <span className="ml-auto text-2xs text-hive-muted">{l.sections.reduce((n, x) => n + x.symbols.length, 0)}</span>
                      </button>
                      <span className="hidden items-center gap-1.5 text-hive-muted group-hover/row:flex">
                        <button
                          className="hover:text-hive-text"
                          title="Rename"
                          onClick={() => {
                            setState({ activeList: l.id });
                            close();
                            setRenaming(l.id);
                          }}
                        >
                          <Icon name="pencil" size={13} />
                        </button>
                        {lists.length > 1 && (
                          <button
                            className="hover:text-hive-down"
                            title="Delete"
                            onClick={() => {
                              close();
                              askDelete(l);
                            }}
                          >
                            <Icon name="x" size={13} />
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="my-1 h-px bg-hive-line" />
                  <button className="menu-item" onClick={() => (close(), addList())}>
                    <Icon name="plus" size={14} />
                    New watchlist
                  </button>
                </div>
              )}
            </Popover>
          )}
        </div>
        <Popover
          align="right"
          button={(_, toggle) => (
            <button className="icon-btn" title="Watchlist settings" onClick={toggle}>
              <Icon name="dots" />
            </button>
          )}
        >
          {(close) => (
            <div className="w-52 text-[13px]">
              <button className="menu-item" onClick={() => (close(), addDivider())}>
                Add divider
              </button>
              <button className="menu-item" disabled={sections.length === 1 && !sections[0].name} onClick={() => (close(), removeAllDividers())}>
                Remove all dividers
              </button>
              <div className="my-1 h-px bg-hive-line" />
              <div className="px-3 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-hive-muted">Columns</div>
              {COLS.map(([k, label]) => (
                <button key={k} className="menu-item" disabled={vis[k] && colList.length === 1} onClick={() => toggleCol(k)}>
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[11px] leading-none ${vis[k] ? "border-hive-accent bg-hive-accent text-white" : "border-hive-line"}`}>{vis[k] ? "✓" : ""}</span>
                  {label}
                </button>
              ))}
              <div className="my-1 h-px bg-hive-line" />
              <button className="menu-item" onClick={() => (close(), addList())}>
                New watchlist
              </button>
              <button className="menu-item" onClick={() => (close(), setRenaming(list.id))}>
                Rename this watchlist
              </button>
              {lists.length > 1 && (
                <button className="menu-item text-hive-down" onClick={() => (close(), askDelete(list))}>
                  Delete this watchlist
                </button>
              )}
            </div>
          )}
        </Popover>
        <button className="icon-btn" title="Add symbol" onClick={() => onAdd(0)}>
          <Icon name="plus" />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 content-start overflow-auto" style={{ gridTemplateColumns: cols, columnGap: "0.9em" }}>
        <div className="sticky top-0 z-10 col-span-full grid bg-hive-panel px-3 py-1.5 text-hive-muted" style={{ gridTemplateColumns: "subgrid", fontSize: "0.8em" }}>
          {HEAD.map(([k, label, right]) => vis[k] && (
            <button
              key={k}
              className={`flex items-center gap-1 whitespace-nowrap hover:text-hive-text ${right ? "justify-end" : ""} ${sort?.key === k ? "text-hive-text" : ""}`}
              title={sort?.key === k ? (sort.dir === "asc" ? "Ascending: click for descending" : "Descending: click for your own order") : "Click to sort ascending"}
              onClick={() => cycleSort(k)}
            >
              {label}
              <span className={`inline-block w-[1em] text-center text-[0.85em] ${sort?.key === k ? "" : "opacity-40"}`}>{sort?.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "–"}</span>
            </button>
          ))}
        </div>
        {sections.map((sec, si) => (
          <div key={si} className="col-span-full grid" style={{ gridTemplateColumns: "subgrid" }}>
            {renamingSec === si ? (
              <input
                autoFocus
                className="input col-span-full mx-2 my-1 h-7 w-40"
                defaultValue={sec.name}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => (editSections((secs) => secs.map((w, i) => (i === si ? { ...w, name: e.target.value.trim() } : w))), setRenamingSec(null))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenamingSec(null);
                }}
              />
            ) : (
              sec.name && (
                <div
                  className="group/sec col-span-full flex h-[2.1em] w-full items-center pr-2 text-hive-muted"
                  style={{ fontSize: "0.8em" }}
                  onDragOver={(e) => {
                    if (!drag) return;
                    e.preventDefault();
                    if (over?.si !== si || over.at !== 0) setOver({ si, at: 0 });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropAt(si, 0);
                  }}
                >
                  <button className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 text-left font-semibold uppercase tracking-wide hover:text-hive-text" onClick={() => setCollapsed((c) => ({ ...c, [sec.name]: !c[sec.name] }))}>
                    <Icon name="chevronDown" size={12} className={collapsed[sec.name] ? "-rotate-90" : ""} />
                    <span className="truncate">{sec.name}</span>
                  </button>
                  <span className="hidden items-center gap-1 group-hover/sec:flex">
                    <button className="hover:text-hive-text" title="Add symbol to this section" onClick={() => onAdd(si)}>
                      <Icon name="plus" size={13} />
                    </button>
                    <button className="hover:text-hive-text" title="Rename divider" onClick={() => setRenamingSec(si)}>
                      <Icon name="pencil" size={13} />
                    </button>
                    <Popover
                      align="right"
                      button={(_, toggle) => (
                        <button className="hover:text-hive-down" title="Remove divider" onClick={toggle}>
                          <Icon name="x" size={13} />
                        </button>
                      )}
                    >
                      {(close) => (
                        <div className="w-56 text-[13px] normal-case tracking-normal text-hive-text">
                          <button className="menu-item" onClick={() => (close(), removeDivider(si))}>
                            Remove divider only
                          </button>
                          <button
                            className={`menu-item text-hive-down ${confirmSec === si ? "font-semibold" : ""}`}
                            onClick={() => {
                              if (sec.symbols.length && confirmSec !== si) {
                                // Ask in place: a second click confirms, nothing blocks the page.
                                setConfirmSec(si);
                                setTimeout(() => setConfirmSec((c) => (c === si ? null : c)), 4000);
                                return;
                              }
                              close();
                              setConfirmSec(null);
                              removeDivider(si, true);
                            }}
                          >
                            {confirmSec === si ? `Click again to delete ${sec.symbols.length} symbol${sec.symbols.length === 1 ? "" : "s"}` : `Remove divider and its ${sec.symbols.length} symbol${sec.symbols.length === 1 ? "" : "s"}`}
                          </button>
                        </div>
                      )}
                    </Popover>
                  </span>
                </div>
              )
            )}
            {!(sec.name && collapsed[sec.name]) &&
              rowsOf(sec.symbols).map(({ sym, yi }) => {
                const q = quotes[sym];
                const up = (q?.changePct ?? 0) >= 0;
                const marker = over?.si === si && drag ? over.at : -1;
                return (
                  <div
                    key={sym}
                    draggable={!sort}
                    className={`group relative col-span-full grid h-[2.4em] items-center px-3 ${sort ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${drag?.sym === sym ? "opacity-40" : ""} ${sym === current ? "bg-hive-accent/10" : "hover:bg-hive-hover"}`}
                    style={{ gridTemplateColumns: "subgrid" }}
                    onClick={() => setState({ symbol: sym })}
                    onDragStart={(e) => {
                      if (sort) return e.preventDefault();
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", sym);
                      setDrag({ si, sym });
                    }}
                    onDragEnd={() => (setDrag(null), setOver(null))}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      const at = e.clientY > r.top + r.height / 2 ? yi + 1 : yi;
                      if (over?.si !== si || over.at !== at) setOver({ si, at });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (over) dropAt(over.si, over.at);
                    }}
                  >
                    {marker === yi && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-hive-accent" />}
                    {marker === yi + 1 && yi === sec.symbols.length - 1 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2px] bg-hive-accent" />}
                    {vis.symbol && <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium">{ticker(sym)}</span>
                      <span className="ml-auto hidden shrink-0 items-center gap-1 text-hive-muted group-hover:flex">
                        {yi > 0 && !sort && (
                          <button
                            className="hover:text-hive-text"
                            title="Start a new divider above this symbol"
                            onClick={(e) => {
                              e.stopPropagation();
                              splitAt(si, yi);
                            }}
                          >
                            <Icon name="dots" size={13} />
                          </button>
                        )}
                        <button
                          className="hover:text-hive-down"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(si, sym);
                          }}
                          title="Remove"
                        >
                          <Icon name="x" size={13} />
                        </button>
                      </span>
                    </span>}
                    {vis.last && <span className="tabular whitespace-nowrap text-right text-hive-text">{fmtPrice(q?.price)}</span>}
                    {vis.chg && <span className={`tabular whitespace-nowrap text-right ${up ? "text-hive-up" : "text-hive-down"}`}>{q?.change != null ? fmtPrice(q.change, digitsFor(q.price)) : ""}</span>}
                    {vis.chgPct && <span className={`tabular whitespace-nowrap text-right ${up ? "text-hive-up" : "text-hive-down"}`}>{fmtPct(q?.changePct)}</span>}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
