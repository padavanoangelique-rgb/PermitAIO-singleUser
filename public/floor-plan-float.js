/* Chrome only: lets the floating panels on the floor plan editor be dragged
anywhere on the canvas. Does not touch drawing tools, canvas, or mapping.
Positions are remembered per browser; double-click a grip to reset one. */
(function () {
  if (window.__paioFloatV1) return;
  window.__paioFloatV1 = true;
  var KEY = "paio-float-pos-v1";
  var TARGETS = [
    { id: "left", sel: ".rail-corner-left" },
    { id: "pan", sel: ".rail-corner-pan" },
    { id: "file", sel: ".rail-corner" },
    { id: "openings", sel: "#paio-size-grid", handle: ".paio-size-head" },
    ];
  var style = document.createElement("style");
  style.textContent =
    ".paio-grip{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" +
    "align-self:stretch;min-width:16px;padding:0 2px;color:#9ca3af;font-size:15px;line-height:1;" +
    "cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;}" +
    ".paio-grip:active{cursor:grabbing;}" +
    ".paio-size-head{cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;}";
  document.head.appendChild(style);
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function save(all) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {
      /* storage blocked, positions just will not persist */
    }
  }
  var saved = load();
  var attached = [];
  function parentOf(el) {
    return el.offsetParent || el.parentElement;
  }
  function place(el, x, y) {
    var par = parentOf(el);
    if (!par) return null;
    var maxX = Math.max(0, par.clientWidth - el.offsetWidth);
    var maxY = Math.max(0, par.clientHeight - el.offsetHeight);
    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);
    el.style.setProperty("left", x + "px", "important");
    el.style.setProperty("top", y + "px", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("transform", "none", "important");
    return { x: x, y: y };
  }
  function reset(el) {
    ["left", "top", "right", "bottom", "transform"].forEach(function (p) {
      el.style.removeProperty(p);
    });
  }
  function attach(t) {
    var el = document.querySelector(t.sel);
    if (!el || el.__paioFloat) return;
    var handle = t.handle ? el.querySelector(t.handle) : null;
    if (t.handle && !handle) return;
    if (!handle) {
      handle = document.createElement("span");
      handle.className = "paio-grip";
      handle.title = "Drag to move (double-click to reset)";
      handle.textContent = "⠇";
      el.insertBefore(handle, el.firstChild);
    }
    el.__paioFloat = true;
    attached.push({ t: t, el: el });
    if (saved[t.id]) place(el, saved[t.id].x, saved[t.id].y);
    handle.addEventListener("dblclick", function () {
      reset(el);
      delete saved[t.id];
      save(saved);
    });
    handle.addEventListener("pointerdown", function (ev) {
      if (ev.button > 0) return;
      var par = parentOf(el);
      if (!par) return;
      var box = el.getBoundingClientRect();
      var pbox = par.getBoundingClientRect();
      var dx = ev.clientX - box.left;
      var dy = ev.clientY - box.top;
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* older browsers fall back to plain events */
      }
      ev.preventDefault();
      ev.stopPropagation();
      function move(e) {
        var p = place(el, e.clientX - dx - pbox.left, e.clientY - dy - pbox.top);
        if (p) saved[t.id] = p;
      }
      function up() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        save(saved);
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }
  function scan() {
    TARGETS.forEach(attach);
  }
  window.addEventListener("resize", function () {
    attached.forEach(function (a) {
      var s = saved[a.t.id];
      if (s) place(a.el, s.x, s.y);
    });
  });
  scan();
  /* The Openings card is built by floor-plan-size-grid.js after load, so keep looking. */
 window.setInterval(scan, 1200);
})();
