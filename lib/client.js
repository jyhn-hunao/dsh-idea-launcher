window.__ModuleLoader__.load({
  id: "dsh-idea-launcher",
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    ;(function (module, exports, require) {
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);

// src/ui/LauncherPill.tsx
var import_react5 = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// src/ui/state.ts
var import_react = __toESM(require("react"), 1);

// src/ui/format.ts
function formatUptime(ms) {
  const total = Math.max(0, Math.floor(ms / 1e3));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${(minutes % 60).toString().padStart(2, "0")}m`;
}
function clampDockHeight(height) {
  if (!Number.isFinite(height)) return 240;
  return Math.round(Math.min(720, Math.max(120, height)));
}
function clampFloatPos(pos, viewport, minVisible = { width: 120, height: 60 }) {
  const maxX = Math.max(8, viewport.width - minVisible.width);
  const maxY = Math.max(8, viewport.height - minVisible.height);
  return {
    x: Math.min(Math.max(8, Math.round(pos.x)), maxX),
    y: Math.min(Math.max(8, Math.round(pos.y)), maxY)
  };
}

// src/ui/state.ts
var API = "/idea-launcher/api";
var MANUAL_ROOT_KEY = "dsh-idea-launcher:manualRoot";
var FOLLOW_KEY = "dsh-idea-launcher:followSession";
var DOCK_OPEN_KEY = "dsh-idea-launcher:dockOpen";
var DOCK_COLLAPSED_KEY = "dsh-idea-launcher:dockCollapsed";
var DOCK_HEIGHT_KEY = "dsh-idea-launcher:dockHeight";
var DOCK_MODE_KEY = "dsh-idea-launcher:dockMode";
var DOCK_POS_KEY = "dsh-idea-launcher:dockPos";
var POLL_MS = 1e3;
var state = {
  active: false,
  dockOpen: readFlag(DOCK_OPEN_KEY, false),
  dockCollapsed: readFlag(DOCK_COLLAPSED_KEY, false),
  dockHeight: readNumber(DOCK_HEIGHT_KEY, 240),
  dockMode: readMode(DOCK_MODE_KEY),
  dockPos: readPos(DOCK_POS_KEY),
  logStick: 0,
  sessionId: null,
  followSession: readFlag(FOLLOW_KEY, true),
  projectRoot: "",
  rootSource: null,
  manualRoot: readString(MANUAL_ROOT_KEY),
  configs: [],
  selected: null,
  loadingConfigs: false,
  error: null,
  diagnostics: [],
  instances: [],
  activeId: null,
  log: "",
  logOffset: 0
};
var listeners = /* @__PURE__ */ new Set();
function getState() {
  return state;
}
function subscribe(listener) {
  listeners.add(listener);
  ensureTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTimer();
  };
}
function set(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}
function readString(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function readFlag(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === void 0 ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}
function readNumber(key, fallback) {
  const raw = readString(key);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function readMode(key) {
  return readString(key) === "float" ? "float" : "inline";
}
function readPos(key) {
  const raw = readString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") return { x: parsed.x, y: parsed.y };
  } catch {
  }
  return null;
}
function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
  }
}
var timer;
var polling = false;
function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, POLL_MS);
}
function stopTimer() {
  if (!timer) return;
  clearInterval(timer);
  timer = void 0;
}
async function tick() {
  if (!state.active && !state.dockOpen) return;
  if (polling) return;
  polling = true;
  try {
    await refreshInstances();
    await pullLogs();
  } finally {
    polling = false;
  }
}
function setSession(sessionId) {
  const next = sessionId ?? null;
  if (state.sessionId === next) return;
  set({ sessionId: next });
  if (state.followSession) void refreshConfigs();
}
function setPanelActive(active) {
  set({ active });
  if (active && state.configs.length === 0) void refreshConfigs();
}
function setDockOpen(open) {
  writeStorage(DOCK_OPEN_KEY, open ? "1" : "0");
  set({ dockOpen: open, ...open ? { dockCollapsed: false } : {} });
  if (open && !state.dockCollapsed) writeStorage(DOCK_COLLAPSED_KEY, "0");
}
function setDockCollapsed(collapsed) {
  writeStorage(DOCK_COLLAPSED_KEY, collapsed ? "1" : "0");
  set({ dockCollapsed: collapsed });
}
function setDockHeight(height) {
  const next = clampDockHeight(height);
  if (next === state.dockHeight) return;
  writeStorage(DOCK_HEIGHT_KEY, String(next));
  set({ dockHeight: next });
}
function setDockMode(mode) {
  writeStorage(DOCK_MODE_KEY, mode);
  set({ dockMode: mode });
}
function setDockPos(pos) {
  writeStorage(DOCK_POS_KEY, JSON.stringify(pos));
  set({ dockPos: pos });
}
function stickToBottom() {
  set({ logStick: state.logStick + 1 });
}
async function clearActiveLog() {
  const instance = activeInstance();
  if (!instance) return;
  try {
    const response = await fetch(`${API}/clear`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: instance.id })
    });
    if (!response.ok) return;
    set({ log: "", logOffset: 0, logStick: state.logStick + 1 });
  } catch {
  }
}
function followCurrentSession() {
  writeStorage(FOLLOW_KEY, "1");
  set({ followSession: true });
  void refreshConfigs();
}
function useManualRoot(root) {
  const manualRoot = root.trim();
  writeStorage(FOLLOW_KEY, "0");
  writeStorage(MANUAL_ROOT_KEY, manualRoot);
  set({ followSession: false, manualRoot });
  void refreshConfigs();
}
async function refreshConfigs() {
  const query = state.followSession && state.sessionId ? `sessionId=${encodeURIComponent(state.sessionId)}` : state.manualRoot ? `path=${encodeURIComponent(state.manualRoot)}` : null;
  if (!query) {
    set({
      loadingConfigs: false,
      error: state.followSession ? "\u8FD8\u6CA1\u6709\u4F1A\u8BDD\u4E0A\u4E0B\u6587\uFF0C\u65E0\u6CD5\u8DDF\u968F\u9879\u76EE\uFF1B\u53EF\u6539\u4E3A\u624B\u52A8\u6307\u5B9A\u9879\u76EE\u6839" : "\u5148\u586B\u9879\u76EE\u6839\u76EE\u5F55"
    });
    return;
  }
  set({ loadingConfigs: true, error: null });
  try {
    const response = await fetch(`${API}/configs?${query}`);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    const configs = body.configs;
    const firstRunnable = configs.find((c) => c.plan !== null)?.name ?? configs[0]?.name ?? null;
    const keep = state.selected && configs.some((c) => c.name === state.selected) ? state.selected : firstRunnable;
    set({
      configs,
      diagnostics: body.diagnostics ?? [],
      selected: keep,
      loadingConfigs: false,
      projectRoot: body.projectRoot,
      rootSource: body.rootSource ?? null,
      // 切换项目时旧实例的日志不再对应当前配置，清掉避免误导
      activeId: null,
      log: "",
      logOffset: 0
    });
  } catch (error) {
    set({ loadingConfigs: false, error: error instanceof Error ? error.message : String(error) });
  }
}
function select(name) {
  set({ selected: name, activeId: null, log: "", logOffset: 0 });
}
function selectedConfig() {
  return state.configs.find((c) => c.name === state.selected);
}
function activeInstance() {
  if (state.activeId) {
    const hit = state.instances.find((i) => i.id === state.activeId);
    if (hit) return hit;
  }
  return state.instances.find((i) => i.configName === state.selected && isLive(i.state));
}
function liveInstances() {
  return state.instances.filter((i) => isLive(i.state));
}
function instanceFor(configName) {
  if (!configName) return void 0;
  const matches = state.instances.filter((i) => i.configName === configName && isLive(i.state));
  return matches[matches.length - 1];
}
function selectInstance(id) {
  if (state.activeId === id) return;
  set({ activeId: id, log: "", logOffset: 0 });
}
function isLive(s) {
  return s === "starting" || s === "running" || s === "stopping";
}
async function start() {
  const config = selectedConfig();
  if (!config) {
    set({ error: "\u8FD8\u6CA1\u9009\u62E9\u8FD0\u884C\u914D\u7F6E" });
    return;
  }
  if (config.plan === null) {
    set({ error: `"${config.name}" \u662F ${config.type} \u914D\u7F6E\uFF0CM6 \u624D\u652F\u6301\u4E00\u952E\u7F16\u6392` });
    return;
  }
  const target = state.followSession && state.sessionId ? { sessionId: state.sessionId } : { projectRoot: state.manualRoot };
  set({ error: null });
  try {
    const response = await fetch(`${API}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...target, configName: config.name })
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    writeStorage(DOCK_OPEN_KEY, "1");
    writeStorage(DOCK_COLLAPSED_KEY, "0");
    set({ activeId: body.instance.id, log: "", logOffset: 0, dockOpen: true, dockCollapsed: false });
    await refreshInstances();
    await pullLogs();
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  }
}
async function stopAll() {
  try {
    const response = await fetch(`${API}/stop-all`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    await refreshInstances();
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  }
}
async function stopInstance(id, mode = "soft") {
  try {
    const response = await fetch(`${API}/stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, mode })
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    await refreshInstances();
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  }
}
async function refreshInstances() {
  try {
    const response = await fetch(`${API}/instances`);
    const body = await response.json();
    if (body.ok) set({ instances: body.instances });
  } catch {
  }
}
async function pullLogs() {
  const instance = activeInstance();
  if (!instance) return;
  const offset = state.activeId === instance.id ? state.logOffset : 0;
  try {
    const response = await fetch(`${API}/logs?id=${encodeURIComponent(instance.id)}&since=${offset}`);
    const body = await response.json();
    if (!body.ok) return;
    set({
      activeId: instance.id,
      log: offset === 0 ? body.text : state.log + body.text,
      logOffset: body.offset
    });
  } catch {
  }
}
function useLauncher() {
  return import_react.default.useSyncExternalStore(subscribe, getState);
}

// src/ui/ConfigMenu.tsx
var import_react3 = __toESM(require("react"), 1);

// src/ui/icons.tsx
var import_react2 = __toESM(require("react"), 1);

// src/ui/config-type.ts
function typeLabel(type) {
  switch (type) {
    case "spring-boot":
      return "Spring Boot";
    case "npm":
      return "npm";
    case "java-app":
      return "Java";
    case "compound":
      return "Compound";
    default:
      return "\u672A\u652F\u6301";
  }
}

// src/ui/icons.tsx
var SIZE = 14;
function ConfigIcon(props) {
  const size = props.size ?? SIZE;
  switch (props.type) {
    // Spring Boot：叶子
    case "spring-boot":
      return /* @__PURE__ */ import_react2.default.createElement("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react2.default.createElement(
        "path",
        {
          d: "M13.6 2.2c.4 4.9-2.3 9.2-7.3 9.9-1.6.2-3-.2-4-1.1 2.6.4 4.6-.4 6-2.1 1.3-1.6 2-3.7 2.5-5.4.8.4 1.7.6 2.8.7z",
          fill: "#6db33f"
        }
      ), /* @__PURE__ */ import_react2.default.createElement("path", { d: "M3.5 11.3c1.7 1.5 4.2 1.6 6.1.6-2.4-.1-4.3-.8-6.1-2.8z", fill: "#4f8f2f" }));
    // npm：包裹箱
    case "npm":
      return /* @__PURE__ */ import_react2.default.createElement("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react2.default.createElement("rect", { x: "1.5", y: "3.5", width: "13", height: "9", rx: "1.5", fill: "#cb3837" }), /* @__PURE__ */ import_react2.default.createElement("rect", { x: "4", y: "6", width: "2", height: "4", fill: "#fff", opacity: "0.92" }), /* @__PURE__ */ import_react2.default.createElement("rect", { x: "7.5", y: "6", width: "2", height: "4", fill: "#fff", opacity: "0.92" }), /* @__PURE__ */ import_react2.default.createElement("rect", { x: "11", y: "6", width: "1.5", height: "2.6", fill: "#fff", opacity: "0.92" }));
    // Java：咖啡杯
    case "java-app":
      return /* @__PURE__ */ import_react2.default.createElement("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react2.default.createElement("path", { d: "M3.2 8.2h7.2v2.4a3.6 3.6 0 0 1-3.6 3.6H6.8a3.6 3.6 0 0 1-3.6-3.6z", fill: "#e76f00" }), /* @__PURE__ */ import_react2.default.createElement("path", { d: "M10.8 8.8h1.3a1.6 1.6 0 0 1 0 3.2h-1.3", fill: "none", stroke: "#e76f00", strokeWidth: "1.2" }), /* @__PURE__ */ import_react2.default.createElement(
        "path",
        {
          d: "M6 2.2c.9.9-.6 1.6 0 2.6M9 2.2c.9.9-.6 1.6 0 2.6",
          fill: "none",
          stroke: "#c94f00",
          strokeWidth: "1",
          strokeLinecap: "round"
        }
      ));
    // Compound：叠加的层
    case "compound":
      return /* @__PURE__ */ import_react2.default.createElement("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react2.default.createElement("rect", { x: "2", y: "3", width: "8", height: "6", rx: "1.2", fill: "#8b5cf6", opacity: "0.55" }), /* @__PURE__ */ import_react2.default.createElement("rect", { x: "6", y: "7", width: "8", height: "6", rx: "1.2", fill: "#8b5cf6" }));
    // 其余（JUnit / Maven / 未识别）：虚线方框，表示"有，但当前不支持"
    default:
      return /* @__PURE__ */ import_react2.default.createElement("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react2.default.createElement(
        "rect",
        {
          x: "2.5",
          y: "2.5",
          width: "11",
          height: "11",
          rx: "2",
          fill: "none",
          stroke: "#9ca3af",
          strokeWidth: "1.2",
          strokeDasharray: "2.4 1.8"
        }
      ));
  }
}

// src/ui/filter.ts
function filterConfigs(items, query) {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return items;
  return items.filter(
    (item) => item.name.toLowerCase().includes(q) || typeLabel(item.type).toLowerCase().includes(q)
  );
}

// src/ui/ConfigMenu.tsx
var itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "6px 10px",
  borderRadius: 5,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left"
};
function ConfigMenu(props) {
  const { configs, selected, onSelect, running = [] } = props;
  const [query, setQuery] = import_react3.default.useState("");
  const [cursor, setCursor] = import_react3.default.useState(0);
  const filtered = import_react3.default.useMemo(() => filterConfigs(configs, query), [configs, query]);
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = filtered[cursor];
      if (hit) onSelect(hit.name);
    }
  };
  return /* @__PURE__ */ import_react3.default.createElement("div", { onKeyDown, style: { display: "flex", flexDirection: "column", maxHeight: "inherit", minHeight: 0 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { padding: 6, borderBottom: "1px solid rgba(127,127,127,0.2)" } }, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      autoFocus: true,
      value: query,
      onChange: (event) => {
        setQuery(event.target.value);
        setCursor(0);
      },
      placeholder: "\u641C\u7D22\u8FD0\u884C\u914D\u7F6E",
      spellCheck: false,
      style: {
        width: "100%",
        height: 26,
        padding: "0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        border: "1px solid rgba(127,127,127,0.35)",
        background: "transparent",
        color: "inherit",
        fontSize: 12
      }
    }
  )), /* @__PURE__ */ import_react3.default.createElement("div", { style: { overflow: "auto", padding: 4 } }, filtered.length === 0 ? /* @__PURE__ */ import_react3.default.createElement("div", { style: { padding: "10px 10px", opacity: 0.65 } }, "\u6CA1\u6709\u5339\u914D\u7684\u8FD0\u884C\u914D\u7F6E") : filtered.map((item, index) => {
    const active = item.name === selected;
    return /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        key: item.name,
        type: "button",
        onMouseEnter: () => setCursor(index),
        onClick: () => onSelect(item.name),
        style: {
          ...itemStyle,
          background: index === cursor ? "rgba(127,127,127,0.16)" : "transparent",
          fontWeight: active ? 600 : 400
        },
        title: item.plan?.display ?? `${typeLabel(item.type)}\uFF08\u6682\u4E0D\u652F\u6301\u542F\u52A8\uFF09`
      },
      /* @__PURE__ */ import_react3.default.createElement(ConfigIcon, { type: item.type }),
      running.includes(item.name) ? /* @__PURE__ */ import_react3.default.createElement("span", { "aria-hidden": true, title: "\u8FD0\u884C\u4E2D", style: { width: 6, height: 6, borderRadius: 3, background: "#16a34a", flex: "0 0 auto" } }) : null,
      /* @__PURE__ */ import_react3.default.createElement("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, item.name),
      item.plan === null ? /* @__PURE__ */ import_react3.default.createElement("span", { style: { opacity: 0.55 } }, "\u6682\u4E0D\u652F\u6301") : item.plan.confidence === "low" ? /* @__PURE__ */ import_react3.default.createElement("span", { style: { opacity: 0.6, color: "#d97706" } }, "\u542B\u5047\u8BBE") : null,
      /* @__PURE__ */ import_react3.default.createElement("span", { style: { opacity: 0.5 } }, typeLabel(item.type)),
      active ? /* @__PURE__ */ import_react3.default.createElement("span", { style: { opacity: 0.7 } }, "\u2713") : null
    );
  })));
}

// src/ui/ConfigPanel.tsx
var import_react4 = __toESM(require("react"), 1);
var row = { display: "flex", alignItems: "center", gap: 8 };
var mono = { fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" };
var iconButton = {
  flex: "0 0 auto",
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderRadius: 6,
  border: "1px solid rgba(127, 127, 127, 0.35)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer"
};
var linkButton = {
  height: 22,
  padding: "0 4px",
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  opacity: 0.85
};
function ConfigPanel(props) {
  const state2 = useLauncher();
  const { sessionId, onClose } = props;
  import_react4.default.useEffect(() => {
    setSession(sessionId);
  }, [sessionId]);
  const config = selectedConfig();
  return /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px 14px", fontSize: 12, color: "inherit" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: row }, /* @__PURE__ */ import_react4.default.createElement("strong", { style: { fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" } }, "\u8FD0\u884C\u914D\u7F6E"), /* @__PURE__ */ import_react4.default.createElement("span", { style: { flex: 1, minWidth: 0, display: "inline-flex", alignItems: "baseline", gap: 4, opacity: 0.75 } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { whiteSpace: "nowrap", opacity: 0.8 } }, state2.followSession ? "\u8DDF\u968F\u4F1A\u8BDD" : "\u624B\u52A8"), /* @__PURE__ */ import_react4.default.createElement(
    "code",
    {
      title: state2.followSession ? state2.projectRoot : state2.manualRoot,
      style: { ...mono, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    },
    state2.followSession ? state2.projectRoot || "\uFF08\u7B49\u5F85\u4F1A\u8BDD cwd\uFF09" : state2.manualRoot || "\uFF08\u672A\u6307\u5B9A\uFF09"
  ), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      style: linkButton,
      onClick: () => state2.followSession ? useManualRoot(state2.projectRoot) : followCurrentSession()
    },
    state2.followSession ? "\u6539\u624B\u52A8" : "\u6539\u8DDF\u968F"
  )), /* @__PURE__ */ import_react4.default.createElement("button", { type: "button", style: iconButton, title: "\u91CD\u65B0\u8BFB\u53D6\u914D\u7F6E", onClick: () => void refreshConfigs(), disabled: state2.loadingConfigs }, /* @__PURE__ */ import_react4.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react4.default.createElement("path", { d: "M12.5 8a4.5 4.5 0 1 1-1.4-3.2", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), /* @__PURE__ */ import_react4.default.createElement("path", { d: "M12 2.5v3h-3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }))), onClose ? /* @__PURE__ */ import_react4.default.createElement("button", { type: "button", style: iconButton, title: "\u5173\u95ED", onClick: onClose }, /* @__PURE__ */ import_react4.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react4.default.createElement("path", { d: "M4.5 4.5l7 7M11.5 4.5l-7 7", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }))) : null), state2.followSession ? null : /* @__PURE__ */ import_react4.default.createElement(ManualRootInput, null), /* @__PURE__ */ import_react4.default.createElement(StatusLine, null), config?.plan ? /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      style: {
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid rgba(127, 127, 127, 0.18)",
        background: "rgba(127, 127, 127, 0.08)",
        ...mono,
        fontSize: 11.5,
        lineHeight: "18px",
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    },
    /* @__PURE__ */ import_react4.default.createElement("span", { style: { wordBreak: "break-all" } }, config.plan.display),
    /* @__PURE__ */ import_react4.default.createElement("span", { style: { opacity: 0.6, wordBreak: "break-all" } }, "cwd ", config.plan.cwd),
    config.plan.jdkName ? /* @__PURE__ */ import_react4.default.createElement("span", { style: { opacity: 0.6, wordBreak: "break-all" } }, "JDK ", config.plan.jdkName, config.plan.javaHome ? `\uFF08${config.plan.javaHome}\uFF09` : "") : null
  ) : config ? /* @__PURE__ */ import_react4.default.createElement("div", { style: { opacity: 0.7 } }, config.type, " \u914D\u7F6E\u6682\u4E0D\u652F\u6301\u5728 V1 \u542F\u52A8\uFF08Compound \u7F16\u6392\u5728 M6\uFF09\u3002") : /* @__PURE__ */ import_react4.default.createElement("div", { style: { opacity: 0.7 } }, "\u5F53\u524D\u9879\u76EE\u6CA1\u6709\u53EF\u542F\u52A8\u7684\u8FD0\u884C\u914D\u7F6E\u3002"));
}
function ManualRootInput() {
  const state2 = useLauncher();
  const [draft, setDraft] = import_react4.default.useState(state2.manualRoot);
  import_react4.default.useEffect(() => {
    setDraft(state2.manualRoot);
  }, [state2.manualRoot]);
  return /* @__PURE__ */ import_react4.default.createElement("div", { style: row }, /* @__PURE__ */ import_react4.default.createElement(
    "input",
    {
      style: { flex: 1, height: 26, padding: "0 8px", borderRadius: 6, border: "1px solid rgba(127, 127, 127, 0.35)", background: "transparent", color: "inherit", fontSize: 12 },
      value: draft,
      placeholder: "\u9879\u76EE\u6839\u76EE\u5F55\uFF0C\u4F8B\u5982 D:/codeData/myself/ydcy",
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter") useManualRoot(draft);
      },
      spellCheck: false
    }
  ), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => useManualRoot(draft),
      style: { height: 26, padding: "0 10px", borderRadius: 6, border: "1px solid rgba(127,127,127,0.35)", background: "transparent", color: "inherit", fontSize: 12, cursor: "pointer" }
    },
    "\u4F7F\u7528"
  ));
}
function StatusLine() {
  const state2 = useLauncher();
  const instance = activeInstance();
  if (!instance) return /* @__PURE__ */ import_react4.default.createElement("span", { style: { opacity: 0.65 } }, state2.error ?? "\u672A\u8FD0\u884C");
  const phase = instance.stopPhase === "hard-killed" ? "\uFF08\u5F3A\u5236\u505C\u6B62\uFF09" : instance.stopPhase === "soft-killed" ? "\uFF08\u4F18\u96C5\u505C\u6B62\uFF09" : "";
  const text = instance.state === "failed" ? `\u5931\u8D25 exitCode=${instance.exitCode ?? "?"}` : instance.state === "stopped" ? `\u5DF2\u505C\u6B62${phase}` : instance.state === "starting" ? "\u542F\u52A8\u4E2D\u2026" : instance.state === "stopping" ? "\u505C\u6B62\u4E2D\u2026" : "\u8FD0\u884C\u4E2D";
  const color = instance.state === "failed" ? "#dc2626" : instance.state === "running" ? "#16a34a" : "inherit";
  return /* @__PURE__ */ import_react4.default.createElement("span", { style: { color, fontWeight: 500 } }, text);
}

// src/ui/diagnostics.ts
var FILE_REF = /[\\/]|\.(xml|json)$/i;
function isRelevantDiagnostic(diagnostic, selectedName) {
  if (!diagnostic.ref) return true;
  if (selectedName && diagnostic.ref === selectedName) return true;
  return FILE_REF.test(diagnostic.ref);
}
function dedupeDiagnostics(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.level}|${item.ref ?? ""}|${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function diagnosticsSummary(items) {
  const errors = items.filter((d) => d.level === "error").length;
  const warnings = items.length - errors;
  const parts = [];
  if (errors > 0) parts.push(`${errors} \u9519\u8BEF`);
  if (warnings > 0) parts.push(`${warnings} \u8B66\u544A`);
  return { errors, warnings, label: parts.join(" \xB7 ") };
}

// src/ui/LauncherPill.tsx
var GAP = 6;
var EDGE = 8;
var shellStyle = {
  display: "inline-flex",
  alignItems: "stretch",
  height: 26,
  border: "1px solid rgba(127, 127, 127, 0.35)",
  borderRadius: 8,
  overflow: "hidden",
  position: "relative"
};
var segmentStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  padding: "0 7px",
  fontSize: 12,
  whiteSpace: "nowrap"
};
var divider = { borderLeft: "1px solid rgba(127,127,127,0.3)" };
function LauncherPill(props) {
  const state2 = useLauncher();
  const [menu, setMenu] = import_react5.default.useState(null);
  const [anchor, setAnchor] = import_react5.default.useState(null);
  const boxRef = import_react5.default.useRef(null);
  const popRef = import_react5.default.useRef(null);
  const { sessionId } = props;
  import_react5.default.useEffect(() => {
    setSession(sessionId);
  }, [sessionId]);
  import_react5.default.useEffect(() => {
    setPanelActive(menu !== null);
  }, [menu]);
  const place = import_react5.default.useCallback(() => {
    const node = boxRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const want = menu === "configs" ? 360 : menu === "diagnostics" ? 520 : 640;
    const width = Math.min(want, window.innerWidth - EDGE * 2);
    const left = menu === "configs" ? Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE)) : Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE));
    const top = rect.bottom + GAP;
    setAnchor({ left, top, width, maxHeight: Math.max(220, window.innerHeight - top - EDGE) });
  }, [menu]);
  import_react5.default.useLayoutEffect(() => {
    if (menu) place();
  }, [menu, place]);
  import_react5.default.useEffect(() => {
    if (!menu) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menu, place]);
  import_react5.default.useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (boxRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setMenu(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  const config = selectedConfig();
  const instance = instanceFor(config?.name);
  const live = instance !== void 0 && (instance.state === "running" || instance.state === "starting");
  const failed = instance?.state === "failed";
  const liveCount = liveInstances().length;
  const diagnostics = import_react5.default.useMemo(
    () => dedupeDiagnostics(
      [...state2.diagnostics ?? [], ...config?.plan?.diagnostics ?? []].filter(
        (item) => isRelevantDiagnostic(item, config?.name ?? null)
      )
    ),
    [state2.diagnostics, config]
  );
  const summary = diagnosticsSummary(diagnostics);
  const tone = failed ? "#dc2626" : live ? "#16a34a" : "currentColor";
  const dotColor = failed ? "#dc2626" : live ? "#16a34a" : "#9ca3af";
  const onRun = () => {
    if (!config) {
      setMenu("configs");
      return;
    }
    if (live && instance) void stopInstance(instance.id, "soft");
    else void start();
  };
  const popover = menu && anchor ? (0, import_react_dom.createPortal)(
    /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        ref: popRef,
        role: "dialog",
        "aria-label": menu === "configs" ? "\u9009\u62E9\u8FD0\u884C\u914D\u7F6E" : menu === "diagnostics" ? "\u8BCA\u65AD\u4FE1\u606F" : "\u8FD0\u884C\u914D\u7F6E\u8BE6\u60C5",
        style: {
          position: "fixed",
          left: anchor.left,
          top: anchor.top,
          width: anchor.width,
          maxHeight: anchor.maxHeight,
          zIndex: 2147483e3,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          borderRadius: 10,
          border: "1px solid rgba(127, 127, 127, 0.35)",
          background: "canvas",
          color: "inherit",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)"
        }
      },
      menu === "configs" ? /* @__PURE__ */ import_react5.default.createElement(
        ConfigMenu,
        {
          configs: state2.configs,
          selected: state2.selected,
          running: liveInstances().map((i) => i.configName),
          onSelect: (name) => {
            select(name);
            setMenu(null);
          }
        }
      ) : menu === "diagnostics" ? /* @__PURE__ */ import_react5.default.createElement(DiagnosticsList, { items: diagnostics }) : /* @__PURE__ */ import_react5.default.createElement(ConfigPanel, { sessionId, onClose: () => setMenu(null) })
    ),
    document.body
  ) : null;
  return /* @__PURE__ */ import_react5.default.createElement("div", { ref: boxRef, style: shellStyle }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => setMenu(menu === "configs" ? null : "configs"),
      "aria-expanded": menu === "configs",
      title: config ? `${config.name}\uFF08${config.type}\uFF09` : "\u9009\u62E9\u8FD0\u884C\u914D\u7F6E",
      style: { ...segmentStyle, maxWidth: 220 }
    },
    /* @__PURE__ */ import_react5.default.createElement("span", { "aria-hidden": true, style: { width: 7, height: 7, borderRadius: 4, background: dotColor, flex: "0 0 auto" } }),
    /* @__PURE__ */ import_react5.default.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, config ? config.name : state2.configs.length === 0 ? "\u65E0\u8FD0\u884C\u914D\u7F6E" : "\u9009\u62E9\u914D\u7F6E"),
    /* @__PURE__ */ import_react5.default.createElement("svg", { width: 12, height: 12, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("path", { d: "M3.5 6l4.5 4.5L12.5 6", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }))
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: onRun,
      title: live ? `\u505C\u6B62 ${config?.name ?? ""}\uFF08Windows \u4E0B\u4E3A\u5F3A\u5236\u505C\u6B62\uFF09` : `\u8FD0\u884C ${config?.name ?? ""}`,
      "aria-label": live ? "\u505C\u6B62" : "\u8FD0\u884C",
      style: { ...segmentStyle, ...divider, padding: "0 6px" }
    },
    live ? /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("rect", { x: "4", y: "4", width: "8", height: "8", rx: "1.2", fill: tone })) : /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("path", { d: "M5 3.4v9.2c0 .5.6.8 1 .5l7-4.6a.6.6 0 0 0 0-1l-7-4.6c-.4-.3-1 0-1 .5z", fill: tone }))
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        if (instance) void stopInstance(instance.id, "hard");
      },
      disabled: !live,
      title: "\u5F3A\u5236\u505C\u6B62\uFF1A\u8DF3\u8FC7\u5BBD\u9650\u671F\u76F4\u63A5 terminate",
      "aria-label": "\u5F3A\u5236\u505C\u6B62",
      style: { ...segmentStyle, ...divider, padding: "0 6px", opacity: live ? 0.9 : 0.35, cursor: live ? "pointer" : "default" }
    },
    /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("path", { d: "M9 1.8L4.2 9h3L6.6 14.2 11.8 6.6h-3z", fill: live ? "#dc2626" : "currentColor" }))
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        if (liveCount === 0) return;
        if (liveCount > 1 && !window.confirm(`\u786E\u5B9A\u505C\u6B62\u5168\u90E8 ${liveCount} \u4E2A\u8FD0\u884C\u5B9E\u4F8B\uFF1F`)) return;
        void stopAll();
      },
      disabled: liveCount === 0,
      title: liveCount > 0 ? `\u5168\u90E8\u505C\u6B62\uFF08\u5F53\u524D ${liveCount} \u4E2A\u5B9E\u4F8B\u5728\u8FD0\u884C\uFF09` : "\u5168\u90E8\u505C\u6B62\uFF08\u5F53\u524D\u6CA1\u6709\u8FD0\u884C\u4E2D\u7684\u5B9E\u4F8B\uFF09",
      "aria-label": "\u5168\u90E8\u505C\u6B62",
      style: {
        ...segmentStyle,
        ...divider,
        padding: "0 6px",
        opacity: liveCount > 0 ? 0.9 : 0.35,
        cursor: liveCount > 0 ? "pointer" : "default"
      }
    },
    /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("rect", { x: "3.5", y: "3", width: "9", height: "6.5", rx: "1.2", fill: liveCount > 0 ? "#dc2626" : "currentColor" }), /* @__PURE__ */ import_react5.default.createElement("path", { d: "M3 12.5h10", stroke: liveCount > 0 ? "#dc2626" : "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }))
  ), diagnostics.length > 0 ? /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => setMenu(menu === "diagnostics" ? null : "diagnostics"),
      "aria-expanded": menu === "diagnostics",
      title: `\u8BCA\u65AD ${diagnostics.length} \u6761\uFF1A${summary.label}`,
      style: { ...segmentStyle, ...divider, padding: "0 6px" }
    },
    /* @__PURE__ */ import_react5.default.createElement(
      "span",
      {
        "aria-hidden": true,
        style: { width: 6, height: 6, borderRadius: 3, background: summary.errors > 0 ? "#dc2626" : "#d97706", flex: "0 0 auto" }
      }
    ),
    /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 11, opacity: 0.85 } }, diagnostics.length)
  ) : null, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => setDockOpen(!state2.dockOpen),
      "aria-pressed": state2.dockOpen,
      title: state2.dockOpen ? "\u6536\u8D77\u65E5\u5FD7\u7A97\u53E3" : "\u5C55\u5F00\u65E5\u5FD7\u7A97\u53E3",
      "aria-label": state2.dockOpen ? "\u6536\u8D77\u65E5\u5FD7\u7A97\u53E3" : "\u5C55\u5F00\u65E5\u5FD7\u7A97\u53E3",
      style: { ...segmentStyle, ...divider, padding: "0 6px", opacity: state2.dockOpen ? 1 : 0.7 }
    },
    /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("rect", { x: "2.5", y: "3.5", width: "11", height: "9", rx: "1.6", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }), /* @__PURE__ */ import_react5.default.createElement("path", { d: "M4.5 6.5h7M4.5 9h5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }))
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => setMenu(menu === "details" ? null : "details"),
      "aria-expanded": menu === "details",
      title: "\u8FD0\u884C\u914D\u7F6E\u8BE6\u60C5\uFF08\u9879\u76EE\u6839 / \u547D\u4EE4 / cwd\uFF09",
      "aria-label": "\u8FD0\u884C\u914D\u7F6E\u8BE6\u60C5",
      style: { ...segmentStyle, ...divider, padding: "0 6px" }
    },
    /* @__PURE__ */ import_react5.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react5.default.createElement("circle", { cx: "3.5", cy: "8", r: "1.2", fill: "currentColor" }), /* @__PURE__ */ import_react5.default.createElement("circle", { cx: "8", cy: "8", r: "1.2", fill: "currentColor" }), /* @__PURE__ */ import_react5.default.createElement("circle", { cx: "12.5", cy: "8", r: "1.2", fill: "currentColor" }))
  ), popover);
}
function DiagnosticsList(props) {
  return /* @__PURE__ */ import_react5.default.createElement("div", { style: { padding: "8px 12px 12px", fontSize: 12 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 6, fontWeight: 600 } }, "\u8BCA\u65AD"), /* @__PURE__ */ import_react5.default.createElement("ul", { style: { margin: 0, paddingLeft: 18 } }, props.items.map((item, index) => /* @__PURE__ */ import_react5.default.createElement(
    "li",
    {
      key: `${item.code}-${index}`,
      style: { color: item.level === "error" ? "#dc2626" : "inherit", lineHeight: "18px", marginBottom: 2 }
    },
    item.ref ? /* @__PURE__ */ import_react5.default.createElement("span", { style: { opacity: 0.65 } }, "[", item.ref, "] ") : null,
    item.message
  ))));
}

// src/ui/LogDock.tsx
var import_react7 = __toESM(require("react"), 1);
var import_react_dom2 = require("react-dom");

// src/ui/LogView.tsx
var import_react6 = __toESM(require("react"), 1);

// src/ui/ansi.ts
var BASIC = ["#3f3f46", "#e06c75", "#98c379", "#d19a66", "#61afef", "#c678dd", "#56b6c2", "#dcdfe4"];
var BRIGHT = ["#7f848e", "#ef7d87", "#b5e08e", "#e6b676", "#83c1f5", "#d79ae8", "#72ccd8", "#ffffff"];
var GENERIC_ESCAPE = /^\u001b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\u0007]*\u0007|[@-_])/;
function normalizeNewlines(text) {
  return text.replace(/\r(?!\n)/g, "\n");
}
function parseAnsi(input, maxSpans = 4e3) {
  if (!input.includes("\x1B")) return [{ text: normalizeNewlines(input) }];
  const spans = [];
  let state2 = {};
  let index = 0;
  const push = (raw) => {
    const text = normalizeNewlines(raw);
    if (!text) return;
    const last = spans[spans.length - 1];
    if (last && sameStyle(last, state2)) {
      last.text += text;
      return;
    }
    spans.push({ text, ...state2 });
  };
  while (index < input.length) {
    const escapeAt = input.indexOf("\x1B", index);
    if (escapeAt < 0) {
      push(input.slice(index));
      break;
    }
    if (escapeAt > index) push(input.slice(index, escapeAt));
    const rest = input.slice(escapeAt);
    const sgr = /^\u001b\[([0-9;]*)m/.exec(rest);
    if (sgr) {
      state2 = applySgr(state2, sgr[1]);
      index = escapeAt + sgr[0].length;
      continue;
    }
    const generic = GENERIC_ESCAPE.exec(rest);
    index = escapeAt + (generic ? generic[0].length : 1);
  }
  if (spans.length > maxSpans) {
    const kept = spans.slice(spans.length - maxSpans);
    kept.unshift({ text: `\u2026\uFF08\u5DF2\u7701\u7565\u524D ${spans.length - maxSpans} \u6BB5\u5F69\u8272\u5185\u5BB9\uFF09
`, dim: true });
    return kept;
  }
  return spans;
}
function sameStyle(span, state2) {
  return span.fg === state2.fg && span.bg === state2.bg && Boolean(span.bold) === Boolean(state2.bold) && Boolean(span.dim) === Boolean(state2.dim) && Boolean(span.underline) === Boolean(state2.underline);
}
function applySgr(current, params) {
  const codes = params.length === 0 ? [0] : params.split(";").map((value) => Number(value) || 0);
  let state2 = { ...current };
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];
    if (code === 0) {
      state2 = {};
    } else if (code === 1) {
      state2.bold = true;
    } else if (code === 2) {
      state2.dim = true;
    } else if (code === 22) {
      state2.bold = false;
      state2.dim = false;
    } else if (code === 4) {
      state2.underline = true;
    } else if (code === 24) {
      state2.underline = false;
    } else if (code >= 30 && code <= 37) {
      state2.fg = BASIC[code - 30];
    } else if (code === 39) {
      state2.fg = void 0;
    } else if (code >= 90 && code <= 97) {
      state2.fg = BRIGHT[code - 90];
    } else if (code >= 40 && code <= 47) {
      state2.bg = BASIC[code - 40];
    } else if (code === 49) {
      state2.bg = void 0;
    } else if (code >= 100 && code <= 107) {
      state2.bg = BRIGHT[code - 100];
    } else if (code === 38 || code === 48) {
      const mode = codes[i + 1];
      if (mode === 5) {
        const color = color256(codes[i + 2] ?? 0);
        if (code === 38) state2.fg = color;
        else state2.bg = color;
        i += 2;
      } else if (mode === 2) {
        const color = `rgb(${codes[i + 2] ?? 0}, ${codes[i + 3] ?? 0}, ${codes[i + 4] ?? 0})`;
        if (code === 38) state2.fg = color;
        else state2.bg = color;
        i += 4;
      } else {
        i += 1;
      }
    }
  }
  return state2;
}
function color256(index) {
  const n = Math.max(0, Math.min(255, index));
  if (n < 8) return BASIC[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n < 232) {
    const value = n - 16;
    const steps = [0, 95, 135, 175, 215, 255];
    const r = steps[Math.floor(value / 36)];
    const g = steps[Math.floor(value % 36 / 6)];
    const b = steps[value % 6];
    return `rgb(${r}, ${g}, ${b})`;
  }
  const gray = 8 + (n - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}
function spanStyle(span) {
  const style = {};
  if (span.fg) style.color = span.fg;
  if (span.bg) style.backgroundColor = span.bg;
  if (span.bold) style.fontWeight = 600;
  if (span.dim) style.opacity = 0.65;
  if (span.underline) style.textDecoration = "underline";
  return style;
}
function toPlainText(input) {
  return parseAnsi(input).map((span) => span.text).join("");
}

// src/ui/LogView.tsx
var TAIL_CHARS = 2e5;
function LogView(props) {
  const { text, height = "100%", stickSignal = 0 } = props;
  const ref = import_react6.default.useRef(null);
  const following = import_react6.default.useRef(true);
  const { spans, truncated } = import_react6.default.useMemo(() => {
    const clipped = text.length > TAIL_CHARS;
    const tail = clipped ? text.slice(text.length - TAIL_CHARS) : text;
    return { spans: parseAnsi(tail), truncated: clipped };
  }, [text]);
  import_react6.default.useEffect(() => {
    const node = ref.current;
    if (!node || !following.current) return;
    node.scrollTop = node.scrollHeight;
  }, [spans]);
  import_react6.default.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    following.current = true;
    node.scrollTop = node.scrollHeight;
  }, [stickSignal]);
  const onScroll = import_react6.default.useCallback(() => {
    const node = ref.current;
    if (!node) return;
    following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 8;
  }, []);
  return /* @__PURE__ */ import_react6.default.createElement(
    "pre",
    {
      ref,
      onScroll,
      style: {
        margin: 0,
        // 背景与边框由外层容器（日志窗口）统一提供，这里透明并撑满，避免"背景跟随文字长度"
        flex: 1,
        width: "100%",
        height,
        minHeight: 0,
        boxSizing: "border-box",
        overflow: "auto",
        padding: "8px 10px",
        background: "transparent",
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        fontSize: 12,
        lineHeight: "17px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all"
      }
    },
    truncated ? /* @__PURE__ */ import_react6.default.createElement("span", { style: { opacity: 0.55 } }, `\u2026\uFF08\u4EC5\u663E\u793A\u6700\u540E ${TAIL_CHARS.toLocaleString()} \u4E2A\u5B57\u7B26\uFF09
`) : null,
    spans.length === 0 ? /* @__PURE__ */ import_react6.default.createElement("span", { style: { opacity: 0.55 } }, "\uFF08\u6682\u65E0\u8F93\u51FA\uFF09") : spans.map((span, index) => /* @__PURE__ */ import_react6.default.createElement("span", { key: index, style: spanStyle(span) }, span.text))
  );
}

// src/ui/LogDock.tsx
var HEADER_HEIGHT = 28;
var FLOAT_WIDTH = 760;
var iconButton2 = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 22,
  borderRadius: 5,
  border: "1px solid transparent",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  padding: 0
};
function LogDock() {
  const state2 = useLauncher();
  if (!state2.dockOpen) return null;
  const instance = activeInstance();
  const config = selectedConfig();
  const name = instance?.configName ?? config?.name ?? "\u65E5\u5FD7";
  const collapsed = state2.dockCollapsed;
  const floating = state2.dockMode === "float";
  const floatPos = state2.dockPos ?? {
    x: Math.max(16, window.innerWidth - FLOAT_WIDTH - 24),
    y: Math.max(16, window.innerHeight - state2.dockHeight - 96)
  };
  const body = /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, /* @__PURE__ */ import_react7.default.createElement(LogHeader, { name, floating }), collapsed ? null : /* @__PURE__ */ import_react7.default.createElement(
    "div",
    {
      style: {
        height: state2.dockHeight,
        padding: "0 10px 10px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column"
      }
    },
    /* @__PURE__ */ import_react7.default.createElement(LogView, { text: state2.log, stickSignal: state2.logStick })
  ));
  if (floating) {
    return (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ import_react7.default.createElement(
        "div",
        {
          style: {
            position: "fixed",
            left: floatPos.x,
            top: floatPos.y,
            width: FLOAT_WIDTH,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 2147482e3,
            display: "flex",
            flexDirection: "column",
            borderRadius: 10,
            border: "1px solid rgba(127, 127, 127, 0.35)",
            background: "canvas",
            color: "inherit",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.28)",
            overflow: "hidden",
            fontSize: 12
          }
        },
        /* @__PURE__ */ import_react7.default.createElement(FloatingDragArea, { pos: floatPos }, body),
        collapsed ? null : /* @__PURE__ */ import_react7.default.createElement(FloatResizeEdge, null)
      ),
      document.body
    );
  }
  return /* @__PURE__ */ import_react7.default.createElement(
    "div",
    {
      style: {
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        borderTop: "1px solid rgba(127, 127, 127, 0.3)",
        overflow: "hidden",
        background: "rgba(127, 127, 127, 0.07)",
        fontSize: 12,
        color: "inherit",
        display: "flex",
        flexDirection: "column"
      }
    },
    /* @__PURE__ */ import_react7.default.createElement(InlineResizeHandle, { collapsed }),
    body
  );
}
function InlineResizeHandle(props) {
  const state2 = useLauncher();
  const onPointerDown = (event) => {
    if (props.collapsed) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = state2.dockHeight;
    const move = (ev) => setDockHeight(startHeight - (ev.clientY - startY));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "ns-resize";
  };
  return /* @__PURE__ */ import_react7.default.createElement(
    "div",
    {
      role: "separator",
      "aria-label": "\u62D6\u62FD\u8C03\u6574\u65E5\u5FD7\u533A\u9AD8\u5EA6",
      title: props.collapsed ? void 0 : "\u4E0A\u4E0B\u62D6\u62FD\u8C03\u6574\u9AD8\u5EA6",
      onPointerDown,
      style: { height: 6, flex: "0 0 auto", cursor: props.collapsed ? "default" : "ns-resize", background: "transparent" }
    }
  );
}
function FloatingDragArea(props) {
  const [dragging, setDragging] = import_react7.default.useState(false);
  const onPointerDown = (event) => {
    if (event.target.closest("button,select,input")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = props.pos.x;
    const originY = props.pos.y;
    setDragging(true);
    const move = (ev) => {
      setDockPos(
        clampFloatPos(
          { x: originX + ev.clientX - startX, y: originY + ev.clientY - startY },
          { width: window.innerWidth, height: window.innerHeight }
        )
      );
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "move";
  };
  return /* @__PURE__ */ import_react7.default.createElement("div", { onPointerDown, style: { cursor: dragging ? "move" : "default" } }, props.children);
}
function FloatResizeEdge() {
  const state2 = useLauncher();
  const onPointerDown = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = state2.dockHeight;
    const move = (ev) => setDockHeight(startHeight + (ev.clientY - startY));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "ns-resize";
  };
  return /* @__PURE__ */ import_react7.default.createElement("div", { role: "separator", "aria-label": "\u62D6\u62FD\u8C03\u6574\u65E5\u5FD7\u533A\u9AD8\u5EA6", onPointerDown, style: { height: 6, flex: "0 0 auto", cursor: "ns-resize" } });
}
function LogHeader(props) {
  const state2 = useLauncher();
  const instance = activeInstance();
  return /* @__PURE__ */ import_react7.default.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: HEADER_HEIGHT,
        padding: "0 8px 0 10px",
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "nowrap"
      }
    },
    /* @__PURE__ */ import_react7.default.createElement(StateDot, null),
    /* @__PURE__ */ import_react7.default.createElement("strong", { style: { fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, props.name),
    /* @__PURE__ */ import_react7.default.createElement("span", { style: { opacity: 0.7, whiteSpace: "nowrap", flex: "0 0 auto" } }, instance ? stateText(instance.state, instance.stopPhase, instance.exitCode) : "\u672A\u8FD0\u884C"),
    instance && instance.state === "running" ? /* @__PURE__ */ import_react7.default.createElement("span", { style: { opacity: 0.5, whiteSpace: "nowrap", flex: "0 0 auto" } }, "\xB7 ", formatUptime(Date.now() - instance.startedAt)) : null,
    /* @__PURE__ */ import_react7.default.createElement(InstanceSwitcher, null),
    /* @__PURE__ */ import_react7.default.createElement("span", { style: { flex: 1, minWidth: 8 } }),
    /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", style: iconButton2, title: "\u5438\u5E95\uFF08\u6EDA\u5230\u6700\u65B0\u5E76\u6062\u590D\u8DDF\u968F\uFF09", onClick: stickToBottom, disabled: !instance }, /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("path", { d: "M8 2.5v8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), /* @__PURE__ */ import_react7.default.createElement("path", { d: "M4.5 7.5L8 11l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }), /* @__PURE__ */ import_react7.default.createElement("path", { d: "M3 13h10", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }))),
    /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", style: iconButton2, title: "\u6E05\u7A7A\u65E5\u5FD7", onClick: () => void clearActiveLog(), disabled: !instance }, /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("path", { d: "M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8h4.8l.6-8", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }))),
    /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", style: iconButton2, title: "\u590D\u5236\u5168\u90E8\u65E5\u5FD7", onClick: () => void copyLog(state2.log), disabled: !instance }, /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("rect", { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1.5", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }), /* @__PURE__ */ import_react7.default.createElement("path", { d: "M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }))),
    /* @__PURE__ */ import_react7.default.createElement(
      "button",
      {
        type: "button",
        style: iconButton2,
        title: props.floating ? "\u8FD8\u539F\u4E3A\u5185\u7F6E\u7A97\u53E3" : "\u5207\u6362\u4E3A\u72EC\u7ACB\u7A97\u53E3",
        "aria-label": props.floating ? "\u8FD8\u539F\u4E3A\u5185\u7F6E\u7A97\u53E3" : "\u5207\u6362\u4E3A\u72EC\u7ACB\u7A97\u53E3",
        onClick: () => setDockMode(props.floating ? "inline" : "float")
      },
      props.floating ? /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("rect", { x: "2.5", y: "8.5", width: "5", height: "5", rx: "1", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }), /* @__PURE__ */ import_react7.default.createElement("path", { d: "M8 8V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9", fill: "none", stroke: "currentColor", strokeWidth: "1.3" })) : /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("rect", { x: "2.5", y: "2.5", width: "7", height: "7", rx: "1", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }), /* @__PURE__ */ import_react7.default.createElement("path", { d: "M9.5 9.5h3a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v3", fill: "none", stroke: "currentColor", strokeWidth: "1.3" }))
    ),
    /* @__PURE__ */ import_react7.default.createElement(
      "button",
      {
        type: "button",
        style: iconButton2,
        title: state2.dockCollapsed ? "\u5C55\u5F00\u65E5\u5FD7\u7A97\u53E3" : "\u6298\u53E0\u65E5\u5FD7\u7A97\u53E3",
        onClick: () => setDockCollapsed(!state2.dockCollapsed)
      },
      /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false", style: { transform: state2.dockCollapsed ? "rotate(180deg)" : void 0 } }, /* @__PURE__ */ import_react7.default.createElement("path", { d: "M4 10l4-4 4 4", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }))
    ),
    /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", style: iconButton2, title: "\u5173\u95ED\u65E5\u5FD7\u7A97\u53E3\uFF08\u4E0D\u4F1A\u505C\u6B62\u8FDB\u7A0B\uFF09", onClick: () => setDockOpen(false) }, /* @__PURE__ */ import_react7.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: "false" }, /* @__PURE__ */ import_react7.default.createElement("path", { d: "M4.5 4.5l7 7M11.5 4.5l-7 7", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })))
  );
}
function InstanceSwitcher() {
  const state2 = useLauncher();
  const live = liveInstances();
  if (live.length < 2) return null;
  const current = activeInstance()?.id ?? state2.activeId ?? "";
  return /* @__PURE__ */ import_react7.default.createElement(
    "select",
    {
      value: current,
      onChange: (event) => selectInstance(event.target.value),
      title: "\u5207\u6362\u8981\u67E5\u770B\u7684\u65E5\u5FD7\u5B9E\u4F8B",
      style: {
        flex: "0 0 auto",
        height: 20,
        maxWidth: 220,
        padding: "0 4px",
        borderRadius: 5,
        border: "1px solid rgba(127,127,127,0.35)",
        background: "transparent",
        color: "inherit",
        fontSize: 11
      }
    },
    live.map((item) => /* @__PURE__ */ import_react7.default.createElement("option", { key: item.id, value: item.id }, item.configName, " \xB7 ", item.id.split("#")[1] ?? item.id))
  );
}
function StateDot() {
  const instance = activeInstance();
  const color = !instance ? "#9ca3af" : instance.state === "failed" ? "#dc2626" : instance.state === "running" ? "#16a34a" : instance.state === "stopped" ? "#9ca3af" : "#f59e0b";
  return /* @__PURE__ */ import_react7.default.createElement("span", { "aria-hidden": true, style: { width: 7, height: 7, borderRadius: 4, background: color, flex: "0 0 auto" } });
}
function stateText(state2, stopPhase, exitCode) {
  if (state2 === "failed") return `\u5931\u8D25 exitCode=${exitCode ?? "?"}`;
  if (state2 === "stopped") return stopPhase === "hard-killed" ? "\u5DF2\u505C\u6B62\uFF08\u5F3A\u5236\uFF09" : stopPhase === "soft-killed" ? "\u5DF2\u505C\u6B62\uFF08\u4F18\u96C5\uFF09" : "\u5DF2\u505C\u6B62";
  if (state2 === "starting") return "\u542F\u52A8\u4E2D\u2026";
  if (state2 === "stopping") return "\u505C\u6B62\u4E2D\u2026";
  return "\u8FD0\u884C\u4E2D";
}
async function copyLog(raw) {
  try {
    await navigator.clipboard.writeText(toPlainText(raw));
  } catch {
  }
}

// src/client.ts
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject(
    "conversation.session.header.utilities",
    () => ctx.slots.register(
      { name: "conversation.session.header.utilities", id: "idea-launcher", order: -20, label: "\u8FD0\u884C" },
      LauncherPill
    )
  );
  ctx.slots.inject("shell.bottom", () => ctx.slots.register({ name: "shell.bottom" }, LogDock));
}

    })(module, exports, require)
    return module.exports
  },
})
