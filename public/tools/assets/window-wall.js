/* Permit Toolkit — Window Wall Designer
   Opening stays fixed. Units + bucks + mullions reflow. Planning aid only. */
(function () {
  "use strict";

  var MIN_UNIT = 4;
  var SNAP = 1;
  var STOCKS = [
    { id: "1x4", nominal: "1x4", tIn: 0.75 },
    { id: "2x4", nominal: "2x4", tIn: 1.5 },
    { id: "2x6", nominal: "2x6", tIn: 1.5 },
    { id: "3x4", nominal: "3x4", tIn: 2.5 },
  ];
  var LABELS = [
    { id: "fixed", name: "Fixed", short: "FX" },
    { id: "SH", name: "Single Hung", short: "SH" },
    { id: "roller", name: "Horizontal Roller", short: "HR" },
    { id: "casement", name: "Casement", short: "CM" },
    { id: "swing", name: "Swing Door", short: "SW" },
    { id: "sgd", name: "Sliding Glass Door", short: "SGD" },
    { id: "halfround", name: "Half Round", short: "HRND" },
  ];

  function stockById(id) {
    for (var i = 0; i < STOCKS.length; i++) if (STOCKS[i].id === id) return STOCKS[i];
    return STOCKS[1];
  }
  function labelName(id) {
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i].id === id) return LABELS[i].name;
    return id;
  }
  function labelShort(id) {
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i].id === id) return LABELS[i].short;
    return id;
  }
  function uid(p) {
    return p + "_" + Math.random().toString(36).slice(2, 9);
  }
  function samePath(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }
  function formatFtIn(inches) {
    if (!isFinite(inches)) return "—";
    var sign = inches < 0 ? "-" : "";
    var total16 = Math.round(Math.abs(inches) * 16);
    var wholeIn = Math.floor(total16 / 16);
    var frac16 = total16 % 16;
    var feet = Math.floor(wholeIn / 12);
    var inn = wholeIn % 12;
    if (frac16 === 0) return sign + feet + "'-" + inn + '"';
    var g = gcd(frac16, 16);
    return sign + feet + "'-" + inn + " " + frac16 / g + "/" + 16 / g + '"';
  }
  function formatIn(inches) {
    if (!isFinite(inches)) return "—";
    var sign = inches < 0 ? "-" : "";
    var total16 = Math.round(Math.abs(inches) * 16);
    var whole = Math.floor(total16 / 16);
    var frac16 = total16 % 16;
    if (frac16 === 0) return sign + whole + '"';
    var g = gcd(frac16, 16);
    var frac = frac16 / g + "/" + 16 / g;
    if (whole === 0) return sign + frac + '"';
    return sign + whole + " " + frac + '"';
  }
  function formatBoth(inches) {
    return formatIn(inches) + "  (" + formatFtIn(inches) + ")";
  }
  function formatPair(w, h) {
    return formatFtIn(w) + " x " + formatFtIn(h);
  }
  function formatDraw(inches) {
    return formatIn(inches);
  }
  function dimLabel(u, axis) {
    if (!u) return "";
    if (u.label === "halfround" && (axis === "v" || axis === "w")) return u.archWRaw || "";
    if (axis === "v" || axis === "w") return u.lockWRaw || "";
    return u.lockHRaw || "";
  }
  function formatDim(inches) {
    return unitMode === "in" ? formatIn(inches) : formatFtIn(inches);
  }
  function parseOpening(raw) {
    var a = parseLength(raw, unitMode);
    if (a != null) return a;
    return parseLength(raw, unitMode === "in" ? "ft" : "in");
  }
  function formatPairDim(w, h) {
    return formatDim(w) + " x " + formatDim(h);
  }
  function parseLength(raw, mode) {
    var s = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[–—]/g, "-");
    if (!s) return null;
    var feetInches = s.match(
      /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*-?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\s*\/\s*(\d+))?)?\s*(?:"|in|inches?)?\s*$/
    );
    if (feetInches) {
      var feet = Number(feetInches[1]);
      var inches = feetInches[2] ? Number(feetInches[2]) : 0;
      if (feetInches[3] && feetInches[4]) {
        var den = Number(feetInches[4]);
        if (den === 0) return null;
        inches += Number(feetInches[3]) / den;
      }
      if (!isFinite(feet) || !isFinite(inches)) return null;
      return feet * 12 + inches;
    }
    var dashed = s.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)(?:\s+(\d+)\s*\/\s*(\d+))?\s*"?\s*$/);
    if (dashed) {
      var inches2 = Number(dashed[2]);
      if (dashed[3] && dashed[4]) {
        var den2 = Number(dashed[4]);
        if (den2 === 0) return null;
        inches2 += Number(dashed[3]) / den2;
      }
      return Number(dashed[1]) * 12 + inches2;
    }
    var justIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)\s*$/);
    if (justIn) return Number(justIn[1]);
    var mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*"?\s*$/);
    if (mixed) {
      var den3 = Number(mixed[3]);
      if (den3 === 0) return null;
      return Number(mixed[1]) + Number(mixed[2]) / den3;
    }
    var frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*"?\s*$/);
    if (frac) {
      var den4 = Number(frac[2]);
      if (den4 === 0) return null;
      return Number(frac[1]) / den4;
    }
    var num = s.match(/^(\d+(?:\.\d+)?)$/);
    if (num) {
      var n = Number(num[1]);
      if ((mode || unitMode) === "in") return n;
      return n * 12;
    }
    return null;
  }

  function pocketOf(state) {
    var t = state.buckStock.tIn;
    return { w: Math.max(0, state.opening.wIn - t * 2), h: Math.max(0, state.opening.hIn - t * 2) };
  }
  function getNode(tree, path) {
    var n = tree;
    for (var i = 0; i < path.length; i++) {
      if (n.kind !== "split") return null;
      n = path[i] === 0 ? n.a : n.b;
    }
    return n;
  }
  function setNode(tree, path, next) {
    if (path.length === 0) return next;
    if (tree.kind !== "split") return tree;
    var head = path[0];
    var rest = path.slice(1);
    if (head === 0) return Object.assign({}, tree, { a: setNode(tree.a, rest, next) });
    return Object.assign({}, tree, { b: setNode(tree.b, rest, next) });
  }
  function prune(node) {
    if (node.kind !== "split") return node;
    var a = prune(node.a);
    var b = prune(node.b);
    if (a.kind === "gap" && b.kind === "gap") return { kind: "gap" };
    return Object.assign({}, node, { a: a, b: b });
  }

  function lockOf(node, axis) {
    if (!node) return null;
    if (node.kind === "unit") {
      var v = axis === "v" ? node.lockW : node.lockH;
      return v != null && isFinite(v) ? Number(v) : null;
    }
    if (node.kind !== "split") return null;
    if (node.axis === axis) {
      var a = lockOf(node.a, axis);
      var b = lockOf(node.b, axis);
      if (a != null && b != null) return a + node.stock.tIn + b;
      return null;
    }
    var a2 = lockOf(node.a, axis);
    var b2 = lockOf(node.b, axis);
    if (a2 != null && b2 != null) return Math.max(a2, b2);
    if (a2 != null) return a2;
    if (b2 != null) return b2;
    return null;
  }
  function flatten(state) {
    var pocket = pocketOf(state);
    var units = [];
    var mullions = [];
    var gaps = [];
    function walk(node, rect, path) {
      if (rect.w <= 0.001 || rect.h <= 0.001) return;
      if (node.kind === "unit") {
        units.push({
          type: "unit",
          id: node.id,
          path: path.slice(),
          label: node.label,
          index: 0,
          x: rect.x,
          y: rect.y,
          // Typed W and H are labels only: they print, but never change the drawing, the opening or the
          // unit next to it. The drawing follows the mullions, which are dragged or dropped.
          w: rect.w,
          h: rect.h,
          lockW: node.lockW,
          lockH: node.lockH,
          lockWRaw: node.lockWRaw,
          lockHRaw: node.lockHRaw,
        });
        return;
      }
      if (node.kind === "gap") {
        gaps.push({ type: "gap", path: path.slice(), x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        return;
      }
      var t = node.stock.tIn;
      var span = node.axis === "v" ? rect.w : rect.h;
      var inner = Math.max(0, span - t);
      var tw = node.aWeight + node.bWeight;
      var aW = tw <= 0 ? inner / 2 : inner * (node.aWeight / tw);
      var bW = inner - aW;
      var aSize = aW;
      var bSize = bW;
      if (node.axis === "v") {
        mullions.push({
          type: "mullion",
          id: node.id,
          path: path.slice(),
          stock: node.stock,
          axis: "v",
          parentRect: rect,
          x: rect.x + aSize,
          y: rect.y,
          w: t,
          h: rect.h,
        });
        walk(node.a, { x: rect.x, y: rect.y, w: aSize, h: rect.h }, path.concat([0]));
        walk(node.b, { x: rect.x + aSize + t, y: rect.y, w: bSize, h: rect.h }, path.concat([1]));
      } else {
        mullions.push({
          type: "mullion",
          id: node.id,
          path: path.slice(),
          stock: node.stock,
          axis: "h",
          parentRect: rect,
          x: rect.x,
          y: rect.y + aSize,
          w: rect.w,
          h: t,
        });
        walk(node.a, { x: rect.x, y: rect.y, w: rect.w, h: aSize }, path.concat([0]));
        walk(node.b, { x: rect.x, y: rect.y + aSize + t, w: rect.w, h: bSize }, path.concat([1]));
      }
    }
    walk(state.tree, { x: 0, y: 0, w: pocket.w, h: pocket.h }, []);
    units.sort(function (a, b) {
      return a.y - b.y || a.x - b.x;
    });
    units.forEach(function (u, i) {
      u.index = i + 1;
    });
    mullions.forEach(function (m, i) {
      m.index = i + 1;
    });
    /* An arch is as wide as the unit under it: show that unit's typed width (nothing is calculated). */
    units.forEach(function (u) {
      if (u.label !== "halfround") return;
      var base = archBaseOf({ units: units }, u);
      u.archBaseIndex = base ? base.index : 0;
      u.archWRaw = base && base.lockWRaw ? base.lockWRaw : "";
    });
    return { pocket: pocket, units: units, mullions: mullions, gaps: gaps };
  }

  /* Half Round: one arch only, always on top of a window or door (a horizontal split whose top is the arch). */
  function hasHalfRound(node) {
    if (!node) return false;
    if (node.kind === "unit") return node.label === "halfround";
    if (node.kind !== "split") return false;
    return hasHalfRound(node.a) || hasHalfRound(node.b);
  }
  /* The unit an arch sits on: its sibling below it. Null when the arch has nothing under it. */
  function archBaseOf(flat, u) {
    if (!u || u.label !== "halfround" || !u.path.length) return null;
    var parent = u.path.slice(0, -1);
    if (u.path[u.path.length - 1] !== 0) return null;
    var sib = parent.concat([1]);
    for (var i = 0; i < flat.units.length; i++) if (samePath(flat.units[i].path, sib)) return flat.units[i];
    return null;
  }

  function canSplitUnit(unit, axis, stock) {
    if (unit && unit.label === "halfround") return false;
    var span = axis === "v" ? unit.w : unit.h;
    return span >= 2 * MIN_UNIT + stock.tIn;
  }
  function canSplitThirds(unit, axis, stock) {
    if (unit && unit.label === "halfround") return false;
    var span = axis === "v" ? unit.w : unit.h;
    return span >= 3 * MIN_UNIT + 2 * stock.tIn;
  }
  function thirdsNode(unit, axis, stock, span) {
    var t = stock.tIn;
    var piece = (span - 2 * t) / 3;
    var inner = span - t;
    var aSize = piece;
    var bSize = inner - aSize;
    return {
      kind: "split",
      id: uid("m"),
      axis: axis,
      stock: stock,
      aWeight: Math.max(0.01, aSize),
      bWeight: Math.max(0.01, bSize),
      a: stripAxisLock({ kind: "unit", id: unit.id, label: unit.label, lockW: unit.lockW, lockH: unit.lockH }, axis),
      b: {
        kind: "split",
        id: uid("m"),
        axis: axis,
        stock: stock,
        aWeight: 1,
        bWeight: 1,
        a: { kind: "unit", id: uid("u"), label: unit.label },
        b: { kind: "unit", id: uid("u"), label: unit.label },
      },
    };
  }
  function leftoverArea(flat) {
    return flat.gaps.reduce(function (s, g) {
      return s + g.w * g.h;
    }, 0);
  }
  function snapIn(v) {
    return Math.round(v / SNAP) * SNAP;
  }
  function snapEighth(v) {
    return Math.round(v * 8) / 8;
  }
  function clampSplitSizes(span, t, aSize) {
    var maxA = span - t - MIN_UNIT;
    var clamped = Math.min(Math.max(aSize, MIN_UNIT), Math.max(MIN_UNIT, maxA));
    return { aWeight: Math.max(0.01, clamped), bWeight: Math.max(0.01, span - t - clamped) };
  }
  function pathKey(p) {
    return (p || []).join(".");
  }
  function geomMap(flat) {
    var g = {};
    function add(item) {
      g[pathKey(item.path)] = { w: item.w, h: item.h };
    }
    flat.units.forEach(add);
    flat.gaps.forEach(add);
    return g;
  }
  function measureNode(node, path, axis, desired, geom) {
    if (!node) return MIN_UNIT;
    var key = pathKey(path);
    if (node.kind === "unit" || node.kind === "gap") {
      if (Object.prototype.hasOwnProperty.call(desired, key)) return desired[key];
      var box = geom[key];
      if (!box) return MIN_UNIT;
      return axis === "v" ? box.w : box.h;
    }
    if (node.kind !== "split") return MIN_UNIT;
    var aS = measureNode(node.a, path.concat([0]), axis, desired, geom);
    var bS = measureNode(node.b, path.concat([1]), axis, desired, geom);
    if (node.axis === axis) return aS + node.stock.tIn + bS;
    return Math.max(aS, bS);
  }
  function relockAxis(node, path, axis, desired, geom) {
    if (!node || node.kind !== "split") return node;
    var a = relockAxis(node.a, path.concat([0]), axis, desired, geom);
    var b = relockAxis(node.b, path.concat([1]), axis, desired, geom);
    var next = Object.assign({}, node, { a: a, b: b });
    if (node.axis === axis) {
      next.aWeight = Math.max(0.01, measureNode(a, path.concat([0]), axis, desired, geom));
      next.bWeight = Math.max(0.01, measureNode(b, path.concat([1]), axis, desired, geom));
    }
    return next;
  }
  function applyUnitSize(state, path, axis, size, raw) {
    size = Math.max(1, Number(size));
    if (!isFinite(size)) return state;
    raw = String(raw || "").trim();
    var n = getNode(state.tree, path);
    if (!n || n.kind !== "unit") return state;
    var stampKeys = {};
    stampKeys[pathKey(path)] = { size: size, raw: raw };
    return Object.assign({}, state, {
      tree: stampAxisLock(state.tree, [], axis, stampKeys),
    });
  }
  function stampAxisLock(node, path, axis, stampKeys) {
    if (node.kind === "unit") {
      var hit = stampKeys[pathKey(path)];
      if (!hit) return node;
      if (axis === "v") return Object.assign({}, node, { lockW: hit.size, lockWRaw: hit.raw });
      return Object.assign({}, node, { lockH: hit.size, lockHRaw: hit.raw });
    }
    if (node.kind !== "split") return node;
    return Object.assign({}, node, {
      a: stampAxisLock(node.a, path.concat([0]), axis, stampKeys),
      b: stampAxisLock(node.b, path.concat([1]), axis, stampKeys),
    });
  }
  function stripAxisLock(unit, axis) {
    var n = Object.assign({}, unit);
    if (axis === "v") {
      delete n.lockW;
      delete n.lockWRaw;
    } else {
      delete n.lockH;
      delete n.lockHRaw;
    }
    return n;
  }
  function weightsFromMullionCenter(m, pointer) {
    var t = m.stock.tIn;
    var span = m.axis === "v" ? m.parentRect.w : m.parentRect.h;
    var start = m.axis === "v" ? m.parentRect.x : m.parentRect.y;
    var p = m.axis === "v" ? pointer.x : pointer.y;
    return clampSplitSizes(span, t, snapIn(p - start - t / 2));
  }
  function weightsFromPointer(m, pointer, edge) {
    var t = m.stock.tIn;
    var span = m.axis === "v" ? m.parentRect.w : m.parentRect.h;
    var start = m.axis === "v" ? m.parentRect.x : m.parentRect.y;
    var p = m.axis === "v" ? pointer.x : pointer.y;
    var aSize = edge === "e" || edge === "s" ? p - start : p - start - t;
    return clampSplitSizes(span, t, snapIn(aSize));
  }
  function movableEdges(tree, unitPath) {
    var edges = [];
    for (var i = unitPath.length; i > 0; i--) {
      var splitPath = unitPath.slice(0, i - 1);
      var child = unitPath[i - 1];
      var parent = getNode(tree, splitPath);
      if (!parent || parent.kind !== "split") continue;
      if (parent.axis === "v") edges.push({ edge: child === 0 ? "e" : "w", splitPath: splitPath });
      else edges.push({ edge: child === 0 ? "s" : "n", splitPath: splitPath });
    }
    return edges;
  }
  function ancestorSplitOnAxis(tree, unitPath, axis) {
    for (var i = unitPath.length; i > 0; i--) {
      var splitPath = unitPath.slice(0, i - 1);
      var child = unitPath[i - 1];
      var parent = getNode(tree, splitPath);
      if (parent && parent.kind === "split" && parent.axis === axis)
        return { splitPath: splitPath, child: child === 0 ? 0 : 1 };
    }
    return null;
  }
  function weightsForChildSize(m, child, newSize) {
    var t = m.stock.tIn;
    var span = m.axis === "v" ? m.parentRect.w : m.parentRect.h;
    var aSize = child === 0 ? newSize : span - t - newSize;
    return clampSplitSizes(span, t, snapIn(aSize));
  }

  function initialState() {
    return {
      opening: { wIn: 120, hIn: 120, wRaw: '120"', hRaw: '120"' },
      buckStock: stockById("2x4"),
      mullionStock: stockById("2x4"),
      tree: { kind: "gap" },
    };
  }

  function reduce(state, action) {
    switch (action.type) {
      case "setOpening":
        return Object.assign({}, state, {
          opening: {
            wIn: Math.max(1, action.wIn),
            hIn: Math.max(1, action.hIn),
            wRaw: action.wRaw != null ? action.wRaw : state.opening.wRaw,
            hRaw: action.hRaw != null ? action.hRaw : state.opening.hRaw,
          },
        });
      case "setBuckStock":
        return Object.assign({}, state, { buckStock: action.stock });
      case "setMullionStock":
        return Object.assign({}, state, { mullionStock: action.stock });
      case "placeUnit": {
        var n = getNode(state.tree, action.path);
        if (!n || n.kind !== "gap") return state;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, {
            kind: "unit",
            id: uid("u"),
            // A half round only goes on top of a window or door, never into an empty pocket.
            label: !action.label || action.label === "halfround" ? "fixed" : action.label,
          }),
        });
      }
      case "splitAt": {
        /* Drop a mullion of a chosen stock on a unit: splits it at the drop point. */
        var ua = getNode(state.tree, action.path);
        if (!ua || ua.kind !== "unit" || ua.label === "halfround") return state;
        var stkA = action.stock || state.mullionStock;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, {
            kind: "split",
            id: uid("m"),
            axis: action.axis,
            stock: stkA,
            aWeight: Math.max(0.01, action.aWeight || 1),
            bWeight: Math.max(0.01, action.bWeight || 1),
            a: stripAxisLock(ua, action.axis),
            b: { kind: "unit", id: uid("u"), label: ua.label },
          }),
        });
      }
      case "addHalfRound": {
        /* One arch, on top of the chosen window or door, with a mullion between. The arch is as wide as the
           unit under it; its rise is typed in H. */
        if (hasHalfRound(state.tree)) return state;
        var ub = getNode(state.tree, action.path);
        if (!ub || ub.kind !== "unit" || ub.label === "halfround") return state;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, {
            kind: "split",
            id: uid("m"),
            axis: "h",
            stock: action.stock || state.mullionStock,
            aWeight: 1,
            bWeight: 2,
            a: { kind: "unit", id: uid("u"), label: "halfround" },
            b: stripAxisLock(ub, "h"),
          }),
        });
      }
      case "split": {
        var u = getNode(state.tree, action.path);
        if (!u || u.kind !== "unit" || u.label === "halfround") return state;
        var next = {
          kind: "split",
          id: uid("m"),
          axis: action.axis,
          stock: state.mullionStock,
          aWeight: 1,
          bWeight: 1,
          a: stripAxisLock(u, action.axis),
          b: { kind: "unit", id: uid("u"), label: u.label },
        };
        return Object.assign({}, state, { tree: setNode(state.tree, action.path, next) });
      }
      case "splitThirds": {
        var u3 = getNode(state.tree, action.path);
        if (!u3 || u3.kind !== "unit" || u3.label === "halfround") return state;
        var flat3 = flatten(state);
        var unitRect = null;
        for (var i3 = 0; i3 < flat3.units.length; i3++) {
          if (samePath(flat3.units[i3].path, action.path)) unitRect = flat3.units[i3];
        }
        if (!unitRect) return state;
        if (!canSplitThirds(unitRect, action.axis, state.mullionStock)) return state;
        var span3 = action.axis === "v" ? unitRect.w : unitRect.h;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, thirdsNode(u3, action.axis, state.mullionStock, span3)),
        });
      }
      case "setLabel": {
        var un = getNode(state.tree, action.path);
        if (!un || un.kind !== "unit") return state;
        // Only addHalfRound makes an arch; only one arch is allowed.
        if (action.label === "halfround") return state;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, Object.assign({}, un, { label: action.label })),
        });
      }
      case "setSplitStock": {
        var sn = getNode(state.tree, action.path);
        if (!sn || sn.kind !== "split") return state;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, Object.assign({}, sn, { stock: action.stock })),
        });
      }
      case "moveSplit": {
        var mn = getNode(state.tree, action.path);
        if (!mn || mn.kind !== "split") return state;
        return Object.assign({}, state, {
          tree: setNode(
            state.tree,
            action.path,
            Object.assign({}, mn, {
              aWeight: Math.max(0.01, action.aWeight),
              bWeight: Math.max(0.01, action.bWeight),
            })
          ),
        });
      }
      case "deleteUnit": {
        var du = getNode(state.tree, action.path);
        if (!du || du.kind !== "unit") return state;
        return Object.assign({}, state, {
          tree: prune(setNode(state.tree, action.path, { kind: "gap" })),
        });
      }
      case "deleteMullion": {
        var dm = getNode(state.tree, action.path);
        if (!dm || dm.kind !== "split") return state;
        if (dm.a.kind === "split" || dm.b.kind === "split") return state;
        var merged;
        if (dm.a.kind === "unit" && dm.b.kind === "unit")
          merged = { kind: "unit", id: dm.a.id, label: dm.a.label === "halfround" ? dm.b.label : dm.a.label };
        else if (dm.a.kind === "unit") merged = dm.a;
        else if (dm.b.kind === "unit") merged = dm.b;
        else merged = { kind: "gap" };
        return Object.assign({}, state, { tree: prune(setNode(state.tree, action.path, merged)) });
      }
      case "setUnitSize":
        return applyUnitSize(state, action.path, action.axis, action.size, action.raw);
      case "clearUnitSize": {
        var cu = getNode(state.tree, action.path);
        if (!cu || cu.kind !== "unit") return state;
        return Object.assign({}, state, {
          tree: setNode(state.tree, action.path, stripAxisLock(cu, action.axis)),
        });
      }
      case "reset":
        return initialState();
      default:
        return state;
    }
  }

  /* ---------- UI ---------- */
  var state = initialState();
  var selection = null;
  var drag = null;
  var pdfUrl = null;
  var floorSchedule = null; // the floor plan's window and door schedule, sent by the floor plan editor
  var floorCurrent = null; // schedule number of the opening this sheet is for
  var sheetMeta = null; // job / client / address / opening mark printed in the sheet title block
  var planImage = null; // small picture of the house floor plan, printed in the corner of the sheet
  var unitMode = "in";
  var past = [];
  var MAX_UNDO = 60;
  try {
    var saved = localStorage.getItem("pt_ww_unit_mode_v2");
    if (saved === "in" || saved === "ft") unitMode = saved;
  } catch (e) {}

  var $ = function (id) {
    return document.getElementById(id);
  };

  function cloneSnap() {
    return {
      state: JSON.parse(JSON.stringify(state)),
      selection: selection
        ? { kind: selection.kind, path: selection.path.slice() }
        : null,
    };
  }
  function pushHistory() {
    past.push(cloneSnap());
    if (past.length > MAX_UNDO) past.shift();
  }
  function undo() {
    if (!past.length) return;
    var snap = past.pop();
    state = snap.state;
    selection = snap.selection;
    render();
  }

  function dispatch(action) {
    var next = reduce(state, action);
    if (next === state) return;
    pushHistory();
    state = next;
    render();
  }

  function selectedUnit(flat) {
    if (!selection || selection.kind !== "unit") return null;
    for (var i = 0; i < flat.units.length; i++)
      if (samePath(flat.units[i].path, selection.path)) return flat.units[i];
    return null;
  }
  function selectedMullion(flat) {
    if (!selection || selection.kind !== "mullion") return null;
    for (var i = 0; i < flat.mullions.length; i++)
      if (samePath(flat.mullions[i].path, selection.path)) return flat.mullions[i];
    return null;
  }

  function toolBtn(label, id, disabled, extra) {
    return (
      '<button type="button" class="ww-btn ' +
      (extra || "") +
      '" data-act="' +
      id +
      '"' +
      (disabled ? " disabled" : "") +
      ">" +
      label +
      "</button>"
    );
  }
  function stockPicker(title, valueId, prefix) {
    var html = '<div class="ww-stock"><div class="l">' + title + "</div>";
    STOCKS.forEach(function (s) {
      html +=
        '<button type="button" class="' +
        (s.id === valueId ? "on" : "") +
        '" data-stock="' +
        prefix +
        s.id +
        '"><span>' +
        s.nominal +
        "</span><span>" +
        formatIn(s.tIn) +
        "</span></button>";
    });
    html += "</div>";
    return html;
  }
  var lastLabel = "fixed";
  var LAYER_DEFS = [
    { id: "opening", name: "Opening" },
    { id: "bucks", name: "Bucks" },
    { id: "units", name: "Units" },
    { id: "ids", name: "Unit IDs" },
    { id: "dims", name: "Dimensions" },
    { id: "mullions", name: "Mullions" },
    { id: "mullLabels", name: "Mullion labels" },
  ];
  var layers = {
    opening: true,
    bucks: true,
    units: true,
    ids: true,
    dims: true,
    mullions: true,
    mullLabels: true,
  };
  try {
    var savedLayers = JSON.parse(localStorage.getItem("pt_ww_layers_v1") || "null");
    if (savedLayers && typeof savedLayers === "object") {
      LAYER_DEFS.forEach(function (d) {
        if (typeof savedLayers[d.id] === "boolean") layers[d.id] = savedLayers[d.id];
      });
    }
  } catch (e) {}
  function layerOn(id) {
    return layers[id] !== false;
  }
  function saveLayers() {
    try {
      localStorage.setItem("pt_ww_layers_v1", JSON.stringify(layers));
    } catch (e) {}
  }
  function layerPanel() {
    var html = '<div class="ww-stock ww-layers"><div class="l">Layers</div>';
    LAYER_DEFS.forEach(function (d) {
      html +=
        '<button type="button" class="' +
        (layerOn(d.id) ? "on" : "") +
        '" data-layer="' +
        d.id +
        '"><span>' +
        d.name +
        "</span><span>" +
        (layerOn(d.id) ? "ON" : "off") +
        "</span></button>";
    });
    html += "</div>";
    return html;
  }

  /* Small pictures of each unit type, used on the palette buttons. */
  function typeIcon(id) {
    var frame = '<rect x="3" y="3" width="38" height="28" rx="1.5" fill="#eff6ff" stroke="#0b0b0c" stroke-width="1.6"/>';
    var blue = "#2563eb";
    var body;
    if (id === "SH") {
      body =
        frame +
        '<line x1="3" y1="18" x2="41" y2="18" stroke="#0b0b0c" stroke-width="1.6"/>' +
        '<path d="M22 6 L17 12 H27 Z M22 28 L17 22 H27 Z" fill="' + blue + '"/>';
    } else if (id === "roller") {
      body =
        frame +
        '<line x1="22" y1="3" x2="22" y2="31" stroke="#0b0b0c" stroke-width="1.6"/>' +
        '<path d="M6 17 L12 12 V22 Z M38 17 L32 12 V22 Z" fill="' + blue + '"/>';
    } else if (id === "casement") {
      body = frame + '<path d="M41 3 L3 17 L41 31" fill="none" stroke="' + blue + '" stroke-width="1.3"/>';
    } else if (id === "swing") {
      body =
        '<rect x="9" y="2" width="26" height="30" rx="1.5" fill="#eff6ff" stroke="#0b0b0c" stroke-width="1.6"/>' +
        '<path d="M9 32 A26 26 0 0 1 35 6" fill="none" stroke="' + blue + '" stroke-width="1.3"/>' +
        '<circle cx="31" cy="18" r="1.6" fill="#0b0b0c"/>';
    } else if (id === "sgd") {
      body =
        frame +
        '<line x1="24" y1="3" x2="24" y2="31" stroke="#0b0b0c" stroke-width="1.6"/>' +
        '<path d="M9 17 H19 M14 13 L9 17 L14 21" fill="none" stroke="' + blue + '" stroke-width="1.4"/>';
    } else if (id === "halfround") {
      body =
        '<path d="M3 31 V17 A19 14 0 0 1 41 17 V31 Z" fill="#eff6ff" stroke="#0b0b0c" stroke-width="1.6"/>' +
        '<line x1="22" y1="3" x2="22" y2="31" stroke="#94a3b8" stroke-width="1"/>';
    } else {
      body = frame + '<rect x="8" y="8" width="28" height="18" fill="none" stroke="#94a3b8" stroke-width="1"/>';
    }
    return '<svg class="ww-ico" viewBox="0 0 44 34" aria-hidden="true">' + body + "</svg>";
  }
  function mullIcon(axis) {
    var g = '<rect x="3" y="3" width="38" height="28" fill="#eff6ff" stroke="#94a3b8"/>';
    var bar =
      axis === "v"
        ? '<rect x="19" y="3" width="6" height="28" fill="#1e293b"/>'
        : '<rect x="3" y="14" width="38" height="6" fill="#1e293b"/>';
    return '<svg class="ww-ico" viewBox="0 0 44 34" aria-hidden="true">' + g + bar + "</svg>";
  }
  function buckIcon() {
    return (
      '<svg class="ww-ico" viewBox="0 0 44 34" aria-hidden="true"><rect x="2" y="2" width="40" height="30" fill="#cbd5e1" stroke="#0b0b0c" stroke-width="1.4"/>' +
      '<rect x="9" y="9" width="26" height="16" fill="#eff6ff" stroke="#94a3b8"/></svg>'
    );
  }

  function typePickerBar(current) {
    var html = "";
    LABELS.forEach(function (l) {
      html +=
        '<button type="button" class="ww-type' +
        (l.id === current ? " on" : "") +
        '" draggable="true" data-label="' +
        l.id +
        '" data-drag="type:' +
        l.id +
        '" title="' +
        (l.id === "halfround"
          ? "Half Round: select a window or door, then click, or drag it onto one. It sits on top."
          : "Click to pick, or drag onto the drawing") +
        '">' +
        typeIcon(l.id) +
        "<span>" +
        l.name +
        "</span></button>";
    });
    return html;
  }

  /* Draggable mullion and buck chips. Drop a mullion on a unit to split it there; drop a buck on the frame. */
  function dragChips() {
    var html =
      '<div class="ww-stock"><div class="l">Drag a mullion onto a unit</div><div class="ww-chips">';
    STOCKS.forEach(function (s) {
      ["v", "h"].forEach(function (ax) {
        html +=
          '<button type="button" class="ww-chip" draggable="true" data-drag="mull:' +
          ax +
          ":" +
          s.id +
          '" title="Drag onto a unit to split it with a ' +
          s.nominal +
          (ax === "v" ? " vertical" : " horizontal") +
          ' mullion">' +
          mullIcon(ax) +
          "<span>" +
          s.nominal +
          (ax === "v" ? " vert" : " horiz") +
          "</span></button>";
      });
    });
    html += '</div></div><div class="ww-stock"><div class="l">Buck stock (drag onto the frame or click)</div><div class="ww-chips">';
    STOCKS.forEach(function (s) {
      html +=
        '<button type="button" class="ww-chip' +
        (s.id === state.buckStock.id ? " on" : "") +
        '" draggable="true" data-drag="buck:' +
        s.id +
        '" data-stock="b:' +
        s.id +
        '" title="Buck ' +
        s.nominal +
        '">' +
        buckIcon() +
        "<span>" +
        s.nominal +
        " " +
        formatIn(s.tIn) +
        "</span></button>";
    });
    html += "</div></div>";
    return html;
  }

  function renderChrome(flat) {
    var su = selectedUnit(flat);
    var sm = selectedMullion(flat);
    var target = su || (flat.units.length === 1 ? flat.units[0] : null);
    var canAdd = flat.gaps.length > 0;
    var canV = target ? canSplitUnit(target, "v", state.mullionStock) : false;
    var canH = target ? canSplitUnit(target, "h", state.mullionStock) : false;
    var can3V = target ? canSplitThirds(target, "v", state.mullionStock) : false;
    var can3H = target ? canSplitThirds(target, "h", state.mullionStock) : false;
    var leftover = leftoverArea(flat);
    var pocket = flat.pocket;

    $("wwTools").innerHTML =
      toolBtn("Add unit", "add", !canAdd) +
      toolBtn("Split vertical", "splitV", !canV) +
      toolBtn("Split horizontal", "splitH", !canH) +
      toolBtn("Split into 3 across", "split3V", !can3V) +
      toolBtn("Split into 3 stacked", "split3H", !can3H) +
      '<p class="ww-hint">Split into 3 makes two mullions and three equal units. Click a mullion to set 1x4 / 2x4 on that bar only. Drag to size.</p>' +
      stockPicker(sm ? "This mullion only" : "Next mullion stock", (sm ? sm.stock : state.mullionStock).id, "m:") +
      dragChips() +
      layerPanel() +
      toolBtn("Delete", "delete", !selection, "danger") +
      toolBtn("Undo", "undo", past.length === 0) +
      toolBtn("Reset layout", "reset") +
      toolBtn("Print / save PDF", "pdf");

    var side =
      '<div class="ww-sec">Live sizes</div>' +
      "<dl>" +
      row("Opening", (state.opening.wRaw || formatDim(state.opening.wIn)) + " x " + (state.opening.hRaw || formatDim(state.opening.hIn))) +
      row("Bucks", state.buckStock.nominal + " " + formatIn(state.buckStock.tIn) + " x4") +
      row("Pocket", formatPairDim(pocket.w, pocket.h)) +
      row(
        "Leftover",
        leftover > 0.05 && flat.gaps[0]
          ? formatPairDim(flat.gaps[0].w, flat.gaps[0].h) + " unassigned"
          : "Filled"
      ) +
      "</dl>" +
      '<p class="ww-hint">Opening W and H stay as you typed them. Unit sizes are labels you type — nothing is added or auto-calculated.</p>' +
      '<div class="ww-sec">Selected</div>';

    if (su) {
      side +=
        '<div style="font-family:General Sans,sans-serif;font-size:18px;font-weight:600;margin-bottom:4px;">U' +
        su.index +
        " · " +
        labelName(su.label) +
        (su.label === "halfround" && archBaseOf(flat, su) ? " on #" + archBaseOf(flat, su).index : "") +
        "</div>" +
        '<div class="inputs-grid-2">' +
        '<div class="field"><label>' + (su.label === "halfround" ? "W (same as the unit below)" : "W") + '</label><input id="unitW" type="text" inputmode="decimal" value="' +
        esc(dimLabel(su, "w")) +
        '"' + (su.label === "halfround" ? " disabled" : "") + '></div>' +
        '<div class="field"><label>' + (su.label === "halfround" ? "Rise (H)" : "H") + '</label><input id="unitH" type="text" inputmode="decimal" value="' +
        esc(dimLabel(su, "h")) +
        '"></div></div>' +
        '<p class="ww-hint">' +
        (su.label === "halfround"
          ? "The arch is as wide as the unit under it. Type its rise (H) to show it on the drawing and PDF."
          : "Type W and H to show them on the drawing and PDF. If you leave a field blank, no size is printed for it.") +
        "</p>";
    } else if (sm) {
      side +=
        "<div style=\"font-family:General Sans,sans-serif;font-size:18px;font-weight:600;\">M" +
        sm.index +
        " · " +
        sm.stock.nominal +
        "</div>" +
        "<dl>" +
        row("Axis", sm.axis === "v" ? "Vertical" : "Horizontal") +
        row("Thickness", formatIn(sm.stock.tIn)) +
        row("Length", formatDim(sm.axis === "v" ? sm.h : sm.w)) +
        "</dl>" +
        '<p class="ww-hint">Stock on this bar only. Other mullions stay as they are. Drag the bar to resize the units.</p>';
    } else {
      side += '<p class="ww-hint">Click a unit or a mullion. Each mullion can be 1x4 or 2x4 on its own.</p>';
    }

    side += '<div class="ww-sec">Units</div>';
    if (flat.units.length === 0) side += '<p class="ww-hint">None yet — click the opening.</p>';
    else {
      side += "<ul class='ww-unit-list'>";
      flat.units.forEach(function (u) {
        var p = esc(JSON.stringify(u.path));
        var on = su && samePath(su.path, u.path) ? " on" : "";
        side +=
          "<li class='ww-unit-row" +
          on +
          "' data-select-unit='" +
          p +
          "'>" +
          "<button type='button' class='ww-unit-id' data-select-unit='" +
          p +
          "'>#" +
          u.index +
          "</button>" +
          "<input data-unit-size='w' data-path='" +
          p +
          "' type='text' inputmode='decimal'" +
          (u.label === "halfround" ? " disabled title='Same width as the unit under it'" : "") +
          " value='" +
          esc(dimLabel(u, "w")) +
          "' aria-label='#" +
          u.index +
          " width'>" +
          "<span>×</span>" +
          "<input data-unit-size='h' data-path='" +
          p +
          "' type='text' inputmode='decimal' value='" +
          esc(dimLabel(u, "h")) +
          "' aria-label='#" +
          u.index +
          " height'>" +
          "</li>";
      });
      side += "</ul>";
    }
    side += '<div class="ww-sec">Mullions</div>';
    if (flat.mullions.length === 0) side += '<p class="ww-hint">None yet — split a unit.</p>';
    else {
      side += "<ul style='list-style:none;font-size:13px;'>";
      flat.mullions.forEach(function (m) {
        side +=
          "<li style='display:flex;justify-content:space-between;padding:3px 0;'><span>M" +
          m.index +
          " " +
          m.stock.nominal +
          " " +
          (m.axis === "v" ? "vert" : "horiz") +
          "</span><span style='color:var(--muted)'>" +
          formatIn(m.stock.tIn) +
          " × " +
          formatDim(m.axis === "v" ? m.h : m.w) +
          "</span></li>";
      });
      side += "</ul>";
    }
    $("wwSide").innerHTML = side;

    var typesEl = $("wwTypes");
    if (typesEl) {
      var typeCurrent = su ? su.label : lastLabel;
      typesEl.innerHTML = typePickerBar(typeCurrent);
    }

    $("wwDock").innerHTML =
      '<button type="button" data-act="add"' +
      (canAdd ? "" : " disabled") +
      ">＋<span>Add</span></button>" +
      '<button type="button" data-act="splitV"' +
      (canV ? "" : " disabled") +
      ">⊞<span>Split |</span></button>" +
      '<button type="button" data-act="splitH"' +
      (canH ? "" : " disabled") +
      ">⊟<span>Split —</span></button>" +
      '<button type="button" data-act="split3V"' +
      (can3V ? "" : " disabled") +
      ">|||<span>3 across</span></button>" +
      '<button type="button" data-act="split3H"' +
      (can3H ? "" : " disabled") +
      ">≡<span>3 stacked</span></button>" +
      '<button type="button" data-act="delete"' +
      (selection ? "" : " disabled") +
      ">✕<span>Delete</span></button>" +
      '<button type="button" data-act="undo"' +
      (past.length ? "" : " disabled") +
      ">↩<span>Undo</span></button>" +
      '<button type="button" data-act="reset">↺<span>Reset</span></button>' +
      '<button type="button" data-act="pdf">⇩<span>PDF</span></button>';

    var sel = $("wwSel");
    if (su) {
      sel.className = "ww-sel";
      sel.innerHTML =
        "<div class='ww-sel-head'><strong>#" +
        su.index +
        " · " +
        labelName(su.label) +
        "</strong></div>" +
        "<div class='ww-sel-sizes'>" +
        "<label>W <input data-unit-size='w' data-path='" +
        esc(JSON.stringify(su.path)) +
        "' type='text' inputmode='decimal' value='" +
        esc(dimLabel(su, "w")) +
        "'></label>" +
        "<label>H <input data-unit-size='h' data-path='" +
        esc(JSON.stringify(su.path)) +
        "' type='text' inputmode='decimal' value='" +
        esc(dimLabel(su, "h")) +
        "'></label>" +
        "</div>";
    } else if (sm) {
      sel.className = "ww-sel";
      sel.innerHTML =
        "<strong>" + sm.stock.nominal + " mullion</strong> · drag the bar to size the two units";
    } else {
      sel.className = "ww-sel empty";
      sel.innerHTML = "";
    }

    bindChrome(flat);
  }

  function row(k, v) {
    return '<div class="ww-row"><dt>' + k + "</dt><dd>" + v + "</dd></div>";
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "\u0026amp;")
      .replace(/"/g, "\u0026quot;")
      .replace(/</g, "\u0026lt;");
  }

  function bindChrome(flat) {
    function onAct(act) {
      if (act === "add") {
        if (flat.gaps[0]) {
          dispatch({ type: "placeUnit", path: flat.gaps[0].path, label: lastLabel });
          selection = { kind: "unit", path: flat.gaps[0].path };
          render();
        }
      } else if (act === "splitV" || act === "splitH" || act === "split3V" || act === "split3H") {
        var unitPath = null;
        if (selection && selection.kind === "unit") unitPath = selection.path.slice();
        else if (flat.units.length === 1) unitPath = flat.units[0].path.slice();
        if (!unitPath) return;
        var axis = act === "splitH" || act === "split3H" ? "h" : "v";
        if (act === "split3V" || act === "split3H") {
          selection = { kind: "unit", path: unitPath.concat([0]) };
          dispatch({ type: "splitThirds", path: unitPath, axis: axis });
        } else {
          selection = { kind: "mullion", path: unitPath };
          dispatch({ type: "split", path: unitPath, axis: axis });
        }
      } else if (act === "delete") {
        if (!selection) return;
        if (selection.kind === "unit") dispatch({ type: "deleteUnit", path: selection.path });
        else dispatch({ type: "deleteMullion", path: selection.path });
        selection = null;
        render();
      } else if (act === "undo") {
        undo();
      } else if (act === "reset") {
        dispatch({ type: "reset" });
        selection = null;
        $("openW").value = '120"';
        $("openH").value = '120"';
        render();
      } else if (act === "pdf") {
        makePdf();
      }
    }
    document.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.onclick = function (e) {
        var act = btn.getAttribute("data-act");
        if (act === "pdf") {
          e.preventDefault();
          return;
        }
        onAct(act);
      };
    });
    document.querySelectorAll("[data-stock]").forEach(function (btn) {
      btn.onclick = function () {
        var raw = btn.getAttribute("data-stock");
        var which = raw.slice(0, 1);
        var id = raw.slice(2);
        var stock = stockById(id);
        if (which === "b") dispatch({ type: "setBuckStock", stock: stock });
        else if (selection && selection.kind === "mullion")
          dispatch({ type: "setSplitStock", path: selection.path, stock: stock });
        else dispatch({ type: "setMullionStock", stock: stock });
      };
    });
    document.querySelectorAll("[data-layer]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-layer");
        layers[id] = !layerOn(id);
        saveLayers();
        render();
      };
    });
    document.querySelectorAll("[data-label]").forEach(function (btn) {
      btn.onclick = function () {
        var chosen = btn.getAttribute("data-label");
        if (chosen === "halfround") {
          // The arch goes on top of the selected window or door.
          var sel = selection && selection.kind === "unit" ? getNode(state.tree, selection.path) : null;
          if (hasHalfRound(state.tree)) flash("Only one half round per opening.");
          else if (!sel || sel.label === "halfround") flash("Select a window or door first. The half round sits on top of it.");
          else {
            var archPath = selection.path.slice();
            dispatch({ type: "addHalfRound", path: archPath });
            selection = { kind: "unit", path: archPath.concat([0]) };
            render();
          }
          return;
        }
        lastLabel = chosen;
        if (selection && selection.kind === "unit")
          dispatch({ type: "setLabel", path: selection.path, label: lastLabel });
        else render();
      };
    });
    document.querySelectorAll("[data-drag]").forEach(function (btn) {
      btn.ondragstart = function (e) {
        e.dataTransfer.setData("text/plain", btn.getAttribute("data-drag"));
        e.dataTransfer.effectAllowed = "copy";
      };
    });
    var uw = $("unitW");
    var uh = $("unitH");
    function commitTypedSize(path, axis, raw) {
      raw = String(raw || "").trim();
      if (!raw) {
        dispatch({ type: "clearUnitSize", path: path, axis: axis });
        return;
      }
      var n = parseOpening(raw);
      if (n == null) {
        render();
        return;
      }
      dispatch({ type: "setUnitSize", path: path, axis: axis, size: n, raw: raw });
    }
    function commitSize(axis, input) {
      var su = selectedUnit(flatten(state));
      if (!su) return;
      commitTypedSize(su.path, axis, input.value);
    }
    if (uw)
      uw.onblur = function () {
        commitSize("v", uw);
      };
    if (uh)
      uh.onblur = function () {
        commitSize("h", uh);
      };
    [uw, uh].forEach(function (el) {
      if (!el) return;
      el.onkeydown = function (e) {
        if (e.key === "Enter") el.blur();
      };
    });
    document.querySelectorAll("[data-unit-size]").forEach(function (el) {
      if (el.id === "unitW" || el.id === "unitH") return;
      el.onblur = function () {
        var path;
        try {
          path = JSON.parse(el.getAttribute("data-path") || "[]");
        } catch (err) {
          return;
        }
        commitTypedSize(path, el.getAttribute("data-unit-size") === "h" ? "h" : "v", el.value);
      };
      el.onkeydown = function (e) {
        if (e.key === "Enter") el.blur();
      };
      el.onclick = function (e) {
        e.stopPropagation();
      };
    });
    document.querySelectorAll("[data-select-unit]").forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        try {
          selection = { kind: "unit", path: JSON.parse(el.getAttribute("data-select-unit") || "[]") };
        } catch (err) {
          return;
        }
        render();
      };
    });
  }

  function commitOpening() {
    var wRaw = $("openW").value.trim();
    var hRaw = $("openH").value.trim();
    var w = parseOpening(wRaw);
    var h = parseOpening(hRaw);
    if (w == null || h == null) {
      $("openW").value = state.opening.wRaw || formatDim(state.opening.wIn);
      $("openH").value = state.opening.hRaw || formatDim(state.opening.hIn);
      return;
    }
    dispatch({
      type: "setOpening",
      wIn: w,
      hIn: h,
      wRaw: wRaw,
      hRaw: hRaw,
    });
  }
  $("openW").addEventListener("blur", commitOpening);
  $("openH").addEventListener("blur", commitOpening);
  ["openW", "openH"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) {
      if (e.key === "Enter") e.target.blur();
    });
  });

  function setUnitMode(next) {
    unitMode = next === "in" ? "in" : "ft";
    try {
      localStorage.setItem("pt_ww_unit_mode_v2", unitMode);
    } catch (e) {}
    var ft = $("modeFt");
    var inn = $("modeIn");
    if (ft) ft.className = unitMode === "ft" ? "on" : "";
    if (inn) inn.className = unitMode === "in" ? "on" : "";
    render();
  }
  $("modeFt").onclick = function () {
    setUnitMode("ft");
  };
  $("modeIn").onclick = function () {
    setUnitMode("in");
  };
  if (unitMode === "in") {
    $("modeFt").className = "";
    $("modeIn").className = "on";
  }

  /* ---------- SVG canvas ---------- */
  function draw() {
    var wrap = $("wwCanvasWrap");
    var svg = $("wwSvg");
    var size = { w: wrap.clientWidth || 640, h: wrap.clientHeight || 420 };
    svg.setAttribute("viewBox", "0 0 " + size.w + " " + size.h);
    svg.setAttribute("width", size.w);
    svg.setAttribute("height", size.h);

    var flat = flatten(state);
    var pad = size.w < 520 ? 28 : 36;
    var ow = state.opening.wIn;
    var oh = state.opening.hIn;
    var scale = Math.min((size.w - pad * 2) / ow, (size.h - pad * 2) / oh);
    var drawW = ow * scale;
    var drawH = oh * scale;
    var ox = (size.w - drawW) / 2;
    var oy = (size.h - drawH) / 2;
    var t = state.buckStock.tIn;
    var pocketX = ox + t * scale;
    var pocketY = oy + t * scale;
    function px(n) {
      return n * scale;
    }

    var ns = "http://www.w3.org/2000/svg";
    function el(name, attrs, text) {
      var n = document.createElementNS(ns, name);
      Object.keys(attrs || {}).forEach(function (k) {
        n.setAttribute(k, attrs[k]);
      });
      if (text != null) n.textContent = text;
      return n;
    }
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = el("defs");
    defs.innerHTML =
      '<pattern id="gap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" stroke-width="1.5"/></pattern>';
    svg.appendChild(defs);

    svg.appendChild(
      el("rect", {
        x: ox,
        y: oy,
        width: drawW,
        height: drawH,
        fill: layerOn("bucks") ? "#cbd5e1" : "#f8fafc",
        stroke: layerOn("opening") ? "#0b0b0c" : "none",
        "stroke-width": layerOn("opening") ? "1.5" : "0",
      })
    );

    if (layerOn("units"))
    flat.gaps.forEach(function (g) {
      var gEl = el("g", { "data-gap": g.path.join(".") });
      gEl.appendChild(
        el("rect", {
          x: pocketX + px(g.x),
          y: pocketY + px(g.y),
          width: px(g.w),
          height: px(g.h),
          fill: "url(#gap-hatch)",
        })
      );
      if (px(g.w) > 64 && px(g.h) > 36) {
        gEl.appendChild(
          el(
            "text",
            {
              x: pocketX + px(g.x) + px(g.w) / 2,
              y: pocketY + px(g.y) + px(g.h) / 2,
              "text-anchor": "middle",
              fill: "#2563eb",
              "font-size": "12",
              "font-family": "Satoshi, sans-serif",
            },
            "Unassigned " + formatPairDim(g.w, g.h)
          )
        );
      }
      gEl.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        dispatch({ type: "placeUnit", path: g.path, label: lastLabel });
        selection = { kind: "unit", path: g.path };
        render();
      });
      svg.appendChild(gEl);
    });

    if (layerOn("units"))
    flat.units.forEach(function (u) {
      var x = pocketX + px(u.x);
      var y = pocketY + px(u.y);
      var w = px(u.w);
      var h = px(u.h);
      var selected = selection && selection.kind === "unit" && samePath(selection.path, u.path);
      var inset = Math.min(10, w * 0.08, h * 0.08);
      var gEl = el("g", { style: "cursor:pointer" });
      if (u.label === "halfround") {
        /* Half round: an arch as wide as the unit, as tall as the rise typed for it. */
        gEl.appendChild(
          el("path", {
            d: "M " + x + " " + (y + h) + " A " + w / 2 + " " + h + " 0 0 1 " + (x + w) + " " + (y + h) + " Z",
            fill: "#fff",
            stroke: selected ? "#2563eb" : "#0b0b0c",
            "stroke-width": selected ? "2.5" : "1.5",
          })
        );
        var ax = w / 2 - inset;
        var ay = Math.max(0, h - inset);
        gEl.appendChild(
          el("path", {
            d:
              "M " + (x + inset) + " " + (y + h) + " A " + Math.max(0, ax) + " " + ay + " 0 0 1 " + (x + w - inset) + " " + (y + h) + " Z",
            fill: "#eff6ff",
            stroke: "#cbd5e1",
            "stroke-width": "0.75",
          })
        );
        gEl.appendChild(
          el("line", { x1: x + w / 2, y1: y + inset, x2: x + w / 2, y2: y + h, stroke: "#0b0b0c", "stroke-width": "1.2", opacity: "0.35" })
        );
      } else {
        gEl.appendChild(
          el("rect", {
            x: x,
            y: y,
            width: w,
            height: h,
            fill: "#fff",
            stroke: selected ? "#2563eb" : "#0b0b0c",
            "stroke-width": selected ? "2.5" : "1.5",
          })
        );
        gEl.appendChild(
          el("rect", {
            x: x + inset,
            y: y + inset,
            width: Math.max(0, w - inset * 2),
            height: Math.max(0, h - inset * 2),
            fill: "#eff6ff",
            stroke: "#cbd5e1",
            "stroke-width": "0.75",
          })
        );
        sash(gEl, u.label, x + inset, y + inset, Math.max(0, w - inset * 2), Math.max(0, h - inset * 2));
      }
      var idLabel = "#" + u.index + "  " + (w > 90 ? labelName(u.label) : labelShort(u.label)).toUpperCase();
      if (layerOn("ids") && w > 28 && h > 16) {
        gEl.appendChild(
          el(
            "text",
            {
              x: x + w / 2,
              y: y + h / 2 + (h < 44 ? 10 : 4),
              "text-anchor": "middle",
              fill: "#2563eb",
              "font-size": h > 64 ? "10" : "9",
              "font-weight": "600",
              "font-family": "General Sans, sans-serif",
              "letter-spacing": "0.8",
              style: "pointer-events:none",
            },
            idLabel
          )
        );
      }
      var dw = dimLabel(u, "w");
      var dh = dimLabel(u, "h");
      if (layerOn("dims") && h >= 56 && w >= 48) {
        if (dw) unitHDim(gEl, x, y + 12, w, dw);
        if (dh) unitVDim(gEl, x + 12, y, h, dh);
      } else if (layerOn("dims") && w > 36 && (dw || dh)) {
        gEl.appendChild(
          el(
            "text",
            {
              x: x + w / 2,
              y: y + Math.min(14, h * 0.42),
              "text-anchor": "middle",
              fill: "#1d4ed8",
              "font-size": "11",
              "font-weight": "700",
              "font-family": "General Sans, sans-serif",
              style: "pointer-events:none",
            },
            dw && dh ? dw + "  ×  " + dh : dw || dh
          )
        );
      }
      gEl.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        selection = { kind: "unit", path: u.path };
        render();
      });
      svg.appendChild(gEl);

      if (selected) {
        movableEdges(state.tree, u.path).forEach(function (me) {
          var hx = x,
            hy = y,
            hw = 10,
            hh = 10;
          if (me.edge === "e") {
            hx = x + w - 5;
            hy = y + h / 2 - 12;
            hw = 10;
            hh = 24;
          }
          if (me.edge === "w") {
            hx = x - 5;
            hy = y + h / 2 - 12;
            hw = 10;
            hh = 24;
          }
          if (me.edge === "s") {
            hx = x + w / 2 - 12;
            hy = y + h - 5;
            hw = 24;
            hh = 10;
          }
          if (me.edge === "n") {
            hx = x + w / 2 - 12;
            hy = y - 5;
            hw = 24;
            hh = 10;
          }
          var handle = el("rect", {
            x: hx,
            y: hy,
            width: hw,
            height: hh,
            rx: 2,
            fill: "#2563eb",
            stroke: "#fff",
            "stroke-width": "1",
            style: "cursor:" + (me.edge === "e" || me.edge === "w" ? "ew-resize" : "ns-resize"),
          });
          handle.addEventListener("pointerdown", function (e) {
            e.stopPropagation();
            e.preventDefault();
            startDrag(e, me.splitPath, me.edge, { ox: ox, oy: oy, scale: scale, t: t });
          });
          svg.appendChild(handle);
        });
      }
    });

    if (layerOn("mullions"))
    flat.mullions.forEach(function (m) {
      var x = pocketX + px(m.x);
      var y = pocketY + px(m.y);
      var w = Math.max(px(m.w), 3);
      var h = Math.max(px(m.h), 3);
      var selected = selection && selection.kind === "mullion" && samePath(selection.path, m.path);
      var gEl = el("g", {
        style: "cursor:" + (m.axis === "v" ? "ew-resize" : "ns-resize"),
      });
      var hitPad = 8;
      if (m.axis === "v") {
        gEl.appendChild(
          el("rect", {
            x: x - hitPad,
            y: y,
            width: w + hitPad * 2,
            height: h,
            fill: "transparent",
          })
        );
      } else {
        gEl.appendChild(
          el("rect", {
            x: x,
            y: y - hitPad,
            width: w,
            height: h + hitPad * 2,
            fill: "transparent",
          })
        );
      }
      gEl.appendChild(
        el("rect", {
          x: x,
          y: y,
          width: w,
          height: h,
          fill: selected ? "#1d4ed8" : "#1e293b",
          stroke: selected ? "#93c5fd" : "none",
          "stroke-width": selected ? "2" : "0",
        })
      );
      var mLabel = "M-" + m.index + "  " + m.stock.nominal + "  " + formatIn(m.stock.tIn);
      var along = m.axis === "v" ? h : w;
      if (layerOn("mullLabels") && along > 36) {
        var txt;
        if (m.axis === "v") {
          var tx = x + w + 11;
          var ty = y + h / 2;
          txt = el(
            "text",
            {
              x: tx,
              y: ty,
              "text-anchor": "middle",
              fill: "#1d4ed8",
              "font-size": "10",
              "font-weight": "700",
              "font-family": "General Sans, sans-serif",
              stroke: "#fff",
              "stroke-width": "3",
              "paint-order": "stroke",
              style: "pointer-events:none",
              transform: "rotate(-90 " + tx + " " + ty + ")",
            },
            mLabel
          );
        } else {
          var tx2 = x + w / 2;
          var ty2 = y - 5;
          txt = el(
            "text",
            {
              x: tx2,
              y: ty2,
              "text-anchor": "middle",
              fill: "#1d4ed8",
              "font-size": "10",
              "font-weight": "700",
              "font-family": "General Sans, sans-serif",
              stroke: "#fff",
              "stroke-width": "3",
              "paint-order": "stroke",
              style: "pointer-events:none",
            },
            mLabel
          );
        }
        gEl.appendChild(txt);
      }
      gEl.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        e.preventDefault();
        selection = { kind: "mullion", path: m.path };
        var originX = e.clientX;
        var originY = e.clientY;
        var started = false;
        var geom = { ox: ox, oy: oy, scale: scale, t: t, pocketX: pocketX, pocketY: pocketY };
        function move(ev) {
          if (started) return;
          if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < 6) return;
          started = true;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          startDrag(ev, m.path, "bar", geom);
        }
        function up() {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          if (!started) render();
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
      svg.appendChild(gEl);
    });

    if (layerOn("opening")) {
    dimLine(svg, ox, oy - 16, ox + drawW, oy - 16, "Opening " + (state.opening.wRaw || formatDraw(ow)));
    /* height label */
    svg.appendChild(
      el(
        "text",
        {
          x: ox - 10,
          y: oy + drawH / 2,
          "text-anchor": "middle",
          fill: "#2563eb",
          "font-size": "11",
          "font-weight": "600",
          "font-family": "General Sans, sans-serif",
          transform: "rotate(-90 " + (ox - 10) + " " + (oy + drawH / 2) + ")",
        },
        "Opening " + (state.opening.hRaw || formatDraw(oh))
      )
    );
    }

    svg._geom = { ox: ox, oy: oy, scale: scale, t: t, pocketX: pocketX, pocketY: pocketY };
  }

  function sash(g, label, x, y, w, h) {
    if (w < 28 || h < 28 || label === "fixed") return;
    var ink = "#0b0b0c";
    var cx = x + w / 2;
    var cy = y + h / 2;
    var ns = "http://www.w3.org/2000/svg";
    function line(x1, y1, x2, y2) {
      var n = document.createElementNS(ns, "line");
      n.setAttribute("x1", x1);
      n.setAttribute("y1", y1);
      n.setAttribute("x2", x2);
      n.setAttribute("y2", y2);
      n.setAttribute("stroke", ink);
      n.setAttribute("stroke-width", "1.5");
      n.setAttribute("opacity", "0.45");
      g.appendChild(n);
    }
    if (label === "SH") line(x, y + h * 0.55, x + w, y + h * 0.55);
    else if (label === "roller") line(cx, y, cx, y + h);
    else if (label === "casement") {
      [0.28, 0.5, 0.72].forEach(function (t) {
        line(x, y + h * t, x + 8, y + h * t);
      });
    } else if (label === "swing") {
      var r = Math.min(w * 0.85, h * 0.55);
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", "M " + x + " " + (y + h - r) + " A " + r + " " + r + " 0 0 1 " + (x + r) + " " + (y + h));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", ink);
      p.setAttribute("stroke-width", "1.25");
      p.setAttribute("opacity", "0.5");
      g.appendChild(p);
    } else if (label === "sgd") line(x + w * 0.55, y, x + w * 0.55, y + h);
  }

  function dimLine(svg, x1, y, x2, y2, label) {
    var ns = "http://www.w3.org/2000/svg";
    function L(a, b, c, d) {
      var n = document.createElementNS(ns, "line");
      n.setAttribute("x1", a);
      n.setAttribute("y1", b);
      n.setAttribute("x2", c);
      n.setAttribute("y2", d);
      n.setAttribute("stroke", "#2563eb");
      n.setAttribute("stroke-width", "1.25");
      n.setAttribute("style", "pointer-events:none");
      svg.appendChild(n);
    }
    L(x1, y, x2, y);
    L(x1, y - 4, x1, y + 4);
    L(x2, y - 4, x2, y + 4);
    var t = document.createElementNS(ns, "text");
    t.setAttribute("x", (x1 + x2) / 2);
    t.setAttribute("y", y - 6);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#2563eb");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-weight", "600");
    t.setAttribute("font-family", "General Sans, sans-serif");
    t.setAttribute("style", "pointer-events:none");
    t.textContent = label;
    svg.appendChild(t);
  }

  function unitHDim(g, x, y, w, label) {
    var ns = "http://www.w3.org/2000/svg";
    function L(a, b, c, d) {
      var n = document.createElementNS(ns, "line");
      n.setAttribute("x1", a);
      n.setAttribute("y1", b);
      n.setAttribute("x2", c);
      n.setAttribute("y2", d);
      n.setAttribute("stroke", "#2563eb");
      n.setAttribute("stroke-width", "1");
      n.setAttribute("opacity", "0.85");
      n.setAttribute("style", "pointer-events:none");
      g.appendChild(n);
    }
    var x1 = x + 6;
    var x2 = x + w - 6;
    L(x1, y, x2, y);
    L(x1, y - 3, x1, y + 3);
    L(x2, y - 3, x2, y + 3);
    var t = document.createElementNS(ns, "text");
    t.setAttribute("x", x + w / 2);
    t.setAttribute("y", y - 4);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#1d4ed8");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-weight", "700");
    t.setAttribute("font-family", "General Sans, sans-serif");
    t.setAttribute("style", "pointer-events:none");
    t.textContent = label;
    g.appendChild(t);
  }

  function unitVDim(g, x, y, h, label) {
    var ns = "http://www.w3.org/2000/svg";
    function L(a, b, c, d) {
      var n = document.createElementNS(ns, "line");
      n.setAttribute("x1", a);
      n.setAttribute("y1", b);
      n.setAttribute("x2", c);
      n.setAttribute("y2", d);
      n.setAttribute("stroke", "#2563eb");
      n.setAttribute("stroke-width", "1");
      n.setAttribute("opacity", "0.85");
      n.setAttribute("style", "pointer-events:none");
      g.appendChild(n);
    }
    var y1 = y + 6;
    var y2 = y + h - 6;
    L(x, y1, x, y2);
    L(x - 3, y1, x + 3, y1);
    L(x - 3, y2, x + 3, y2);
    var t = document.createElementNS(ns, "text");
    var midY = y + h / 2;
    t.setAttribute("x", x);
    t.setAttribute("y", midY);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#1d4ed8");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-weight", "700");
    t.setAttribute("font-family", "General Sans, sans-serif");
    t.setAttribute("style", "pointer-events:none");
    t.setAttribute("transform", "rotate(-90 " + x + " " + midY + ")");
    t.textContent = label;
    g.appendChild(t);
  }

  function clientToInches(e, geom) {
    var svg = $("wwSvg");
    var pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return {
      x: (p.x - geom.pocketX) / geom.scale,
      y: (p.y - geom.pocketY) / geom.scale,
    };
  }

  function startDrag(e, splitPath, edge, geom) {
    var flat = flatten(state);
    var mull = null;
    for (var i = 0; i < flat.mullions.length; i++)
      if (samePath(flat.mullions[i].path, splitPath)) mull = flat.mullions[i];
    if (!mull) return;
    drag = { splitPath: splitPath, edge: edge, geom: geom, mull: mull };
    pushHistory();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", endDrag);
  }
  function onDrag(e) {
    if (!drag) return;
    var svg = $("wwSvg");
    var geom = svg._geom || drag.geom;
    var p = clientToInches(e, geom);
    var w =
      drag.edge === "bar"
        ? weightsFromMullionCenter(drag.mull, p)
        : weightsFromPointer(drag.mull, p, drag.edge);
    state = reduce(state, {
      type: "moveSplit",
      path: drag.splitPath,
      aWeight: w.aWeight,
      bWeight: w.bWeight,
    });
    var live = $("wwLive");
    var m = flatten(state).mullions.filter(function (mm) {
      return samePath(mm.path, drag.splitPath);
    })[0];
    if (m) {
      var a = m.axis === "v" ? m.x - m.parentRect.x : m.y - m.parentRect.y;
      var b =
        m.axis === "v"
          ? m.parentRect.w - (m.x - m.parentRect.x) - m.w
          : m.parentRect.h - (m.y - m.parentRect.y) - m.h;
      live.style.display = "block";
      live.textContent = formatDraw(a) + "  /  " + formatDraw(b) + "   snap 1\"";
    }
    draw();
  }
  function endDrag() {
    drag = null;
    $("wwLive").style.display = "none";
    window.removeEventListener("pointermove", onDrag);
    window.removeEventListener("pointerup", endDrag);
    render();
  }
  function renderCanvasOnly() {
    draw();
  }

  /* A short message over the drawing (uses the same bubble as the drag readout). */
  var flashTimer = null;
  function flash(msg) {
    var live = $("wwLive");
    if (!live) return;
    live.style.display = "block";
    live.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      live.style.display = "none";
    }, 2600);
  }

  /* Drag and drop from the palette onto the drawing. */
  function unitAt(flat, p) {
    for (var i = 0; i < flat.units.length; i++) {
      var u = flat.units[i];
      if (p.x >= u.x && p.x <= u.x + u.w && p.y >= u.y && p.y <= u.y + u.h) return u;
    }
    return null;
  }
  function gapAt(flat, p) {
    for (var i = 0; i < flat.gaps.length; i++) {
      var g = flat.gaps[i];
      if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) return g;
    }
    return null;
  }
  function handleDrop(e, data) {
    var svg = $("wwSvg");
    var geom = svg && svg._geom;
    if (!geom || !data) return;
    var parts = String(data).split(":");
    var kind = parts[0];
    if (kind === "buck") {
      dispatch({ type: "setBuckStock", stock: stockById(parts[1]) });
      return;
    }
    var p = clientToInches(e, geom);
    var flat = flatten(state);
    var unit = unitAt(flat, p);
    if (kind === "type") {
      var id = parts[1];
      if (id === "halfround") {
        if (hasHalfRound(state.tree)) return flash("Only one half round per opening.");
        if (!unit || unit.label === "halfround") return flash("Drop the half round on a window or door. It sits on top.");
        var ap = unit.path.slice();
        dispatch({ type: "addHalfRound", path: ap });
        selection = { kind: "unit", path: ap.concat([0]) };
        render();
        return;
      }
      lastLabel = id;
      if (unit) {
        dispatch({ type: "setLabel", path: unit.path, label: id });
        selection = { kind: "unit", path: unit.path };
      } else {
        var gap = gapAt(flat, p);
        if (!gap) return;
        dispatch({ type: "placeUnit", path: gap.path, label: id });
        selection = { kind: "unit", path: gap.path };
      }
      render();
      return;
    }
    if (kind === "mull") {
      var axis = parts[1] === "h" ? "h" : "v";
      var stock = stockById(parts[2]);
      /* Dropped right on a bar that is already there: change just that bar. */
      var slack = 3;
      for (var mi = 0; mi < flat.mullions.length; mi++) {
        var bar = flat.mullions[mi];
        if (bar.path && p.x >= bar.x - slack && p.x <= bar.x + bar.w + slack && p.y >= bar.y - slack && p.y <= bar.y + bar.h + slack) {
          dispatch({ type: "setSplitStock", path: bar.path, stock: stock });
          selection = { kind: "mullion", path: bar.path };
          render();
          return;
        }
      }
      if (!unit) return flash("Drop the mullion on a window or door.");
      if (unit.label === "halfround") return flash("A half round is not split.");
      var span = axis === "v" ? unit.w : unit.h;
      if (span < 2 * MIN_UNIT + stock.tIn) return flash("That unit is too small to split.");
      var off = axis === "v" ? p.x - unit.x : p.y - unit.y;
      var w = clampSplitSizes(span, stock.tIn, snapIn(off - stock.tIn / 2));
      var sp = unit.path.slice();
      dispatch({ type: "splitAt", path: sp, axis: axis, stock: stock, aWeight: w.aWeight, bWeight: w.bWeight });
      selection = { kind: "mullion", path: sp };
      render();
    }
  }
  (function bindDrop() {
    var wrapEl = $("wwCanvasWrap");
    if (!wrapEl) return;
    wrapEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    wrapEl.addEventListener("drop", function (e) {
      e.preventDefault();
      var data = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
      handleDrop(e, data);
    });
  })();

  function render() {
    try {
      var node = selection ? getNode(state.tree, selection.path) : null;
      if (selection) {
        if (!node) selection = null;
        else if (selection.kind === "unit" && node.kind !== "unit") selection = null;
        else if (selection.kind === "mullion" && node.kind !== "split") selection = null;
      }
      var ow = $("openW");
      var oh = $("openH");
      if (ow && document.activeElement !== ow) ow.value = state.opening.wRaw || formatDim(state.opening.wIn);
      if (oh && document.activeElement !== oh) oh.value = state.opening.hRaw || formatDim(state.opening.hIn);
      var flat = flatten(state);
      renderChrome(flat);
      draw();
    } catch (err) {
      console.error(err);
      var side = $("wwSide");
      if (side) side.textContent = "Designer error: " + err.message;
    }
  }

  window.addEventListener("resize", function () {
    draw();
  });
  window.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === "Escape") {
      selection = null;
      render();
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection) {
      e.preventDefault();
      if (selection.kind === "unit") dispatch({ type: "deleteUnit", path: selection.path });
      else dispatch({ type: "deleteMullion", path: selection.path });
      selection = null;
      render();
    }
  });

  /* ---------- PDF ---------- */
  function winAnsi(s) {
    return String(s)
      .replace(/[×✕✖]/g, "x")
      .replace(/[—–−]/g, "-")
      .replace(/[′’‘]/g, "'")
      .replace(/[″“”]/g, '"')
      .replace(/[²]/g, "2")
      .replace(/[·•]/g, " ")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
  }

  function commitAllVisibleSizes() {
    var next = state;
    var seen = {};
    function applyOne(path, axis, raw) {
      if (!path) return;
      raw = String(raw || "").trim();
      if (!raw) return;
      var n = parseOpening(raw);
      if (n == null) return;
      var key = pathKey(path) + ":" + axis;
      if (seen[key]) return;
      seen[key] = true;
      next = applyUnitSize(next, path, axis, n, String(raw).trim());
    }
    var su = selectedUnit(flatten(state));
    var uw = $("unitW");
    var uh = $("unitH");
    if (su && uw && !uw.disabled) applyOne(su.path, "v", uw.value);
    if (su && uh && !uh.disabled) applyOne(su.path, "h", uh.value);
    document.querySelectorAll("[data-unit-size]").forEach(function (el) {
      if (el.disabled) return;
      var path;
      try {
        path = JSON.parse(el.getAttribute("data-path") || "[]");
      } catch (err) {
        return;
      }
      applyOne(path, el.getAttribute("data-unit-size") === "h" ? "h" : "v", el.value);
    });
    if (next !== state) {
      pushHistory();
      state = next;
    }
  }

  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      s.onload = function () {
        if (window.PDFLib) resolve(window.PDFLib);
        else reject(new Error("PDF library did not load"));
      };
      s.onerror = function () {
        reject(new Error("Could not load PDF library"));
      };
      document.head.appendChild(s);
    });
  }

  async function makePdf() {
    try {
      try {
        commitAllVisibleSizes();
      } catch (ignore) {}
      await loadPdfLib();
      if (!window.PDFLib) {
        alert("PDF library still loading — try again in a second.");
        return;
      }
    var PDFDocument = PDFLib.PDFDocument;
    var StandardFonts = PDFLib.StandardFonts;
    var rgb = PDFLib.rgb;
    var degrees = PDFLib.degrees;
    var pdf = await PDFDocument.create();
    var page = pdf.addPage([792, 612]);
    var pageW = 792,
      pageH = 612;
    var font = await pdf.embedFont(StandardFonts.Helvetica);
    var bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    var NAVY = rgb(0.043, 0.122, 0.227);
    var GOLD = rgb(0.145, 0.388, 0.922);
    var CREAM = rgb(1, 1, 1);
    var INK = rgb(0.05, 0.08, 0.12);
    var MUTED = rgb(0.35, 0.4, 0.48);
    var RULE = rgb(0.78, 0.82, 0.88);
    function yOf(top) {
      return pageH - top;
    }
    function write(str, x, y, size, fnt, color) {
      var s = winAnsi(String(str == null ? "" : str));
      if (!s) return;
      page.drawText(s, { x: x, y: y, size: size, font: fnt || font, color: color || INK });
    }
    function fitStr(str, maxW, size, fnt) {
      var s = winAnsi(String(str || ""));
      var f = fnt || font;
      if (f.widthOfTextAtSize(s, size) <= maxW) return s;
      while (s.length > 1 && f.widthOfTextAtSize(s + "...", size) > maxW) s = s.slice(0, -1);
      return s + "...";
    }
    function rect(x, top, w, h, opts) {
      var spec = {
        x: x,
        y: yOf(top + h),
        width: w,
        height: h,
      };
      if (opts.fill) spec.color = opts.fill;
      if (opts.stroke) {
        spec.borderColor = opts.stroke;
        spec.borderWidth = opts.thickness || 1;
      }
      page.drawRectangle(spec);
    }
    function pdfLine(x1, top1, x2, top2) {
      page.drawLine({
        start: { x: x1, y: yOf(top1) },
        end: { x: x2, y: yOf(top2) },
        thickness: 0.8,
        color: NAVY,
        opacity: 0.55,
      });
    }
    function pdfSash(label, x, top, w, h) {
      if (w < 12 || h < 12 || label === "fixed") return;
      var cx = x + w / 2;
      if (label === "SH") {
        pdfLine(x, top + h * 0.55, x + w, top + h * 0.55);
      } else if (label === "roller") {
        pdfLine(cx, top, cx, top + h);
      } else if (label === "casement") {
        [0.28, 0.5, 0.72].forEach(function (t) {
          pdfLine(x, top + h * t, x + Math.min(7, w * 0.12), top + h * t);
        });
      } else if (label === "swing") {
        var r = Math.min(w * 0.85, h * 0.6);
        var steps = 10;
        for (var i = 0; i < steps; i++) {
          var a0 = (Math.PI / 2) * (i / steps);
          var a1 = (Math.PI / 2) * ((i + 1) / steps);
          pdfLine(
            x + r * Math.sin(a0),
            top + h - r * Math.cos(a0),
            x + r * Math.sin(a1),
            top + h - r * Math.cos(a1)
          );
        }
        pdfLine(x, top + h - r, x, top + h);
      } else if (label === "sgd") {
        pdfLine(x + w * 0.55, top, x + w * 0.55, top + h);
        pdfLine(x + w * 0.2, top + h * 0.5, x + w * 0.42, top + h * 0.5);
        pdfLine(x + w * 0.65, top + h * 0.5, x + w * 0.88, top + h * 0.5);
      }
    }

    var flat = flatten(state);
    var tBuck = state.buckStock.tIn;
    var today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    var ow = state.opening.wIn,
      oh = state.opening.hIn;
    var BLUE = GOLD;
    var WHITE = rgb(1, 1, 1);
    var GLASS = rgb(0.94, 0.97, 1);
    var meta = sheetMeta || {};
    var M = 24; // page margin
    var sheetNo = 1;

    /* ---------- small drawing helpers (all coordinates are measured from the top of the page) ---------- */
    function ln(x1, t1, x2, t2, color, th) {
      page.drawLine({ start: { x: x1, y: yOf(t1) }, end: { x: x2, y: yOf(t2) }, thickness: th || 0.6, color: color || RULE });
    }
    function textW(s, size, fnt) {
      return (fnt || font).widthOfTextAtSize(winAnsi(String(s)), size);
    }
    function writeR(str, xRight, top, size, fnt, color) {
      write(str, xRight - textW(str, size, fnt), yOf(top), size, fnt, color);
    }
    function writeC(str, xc, top, size, fnt, color) {
      write(str, xc - textW(str, size, fnt) / 2, yOf(top), size, fnt, color);
    }
    /* Always inches, even when the opening was typed in feet. */
    function inchesText(n) {
      return String(Math.round(n * 1000) / 1000);
    }
    function pdfArch(x, top, w, h, fill, stroke, thick) {
      var d = "M " + x + " " + (top + h);
      for (var k = 0; k <= 28; k++) {
        var th = Math.PI - (Math.PI * k) / 28;
        d += " L " + (x + w / 2 + (w / 2) * Math.cos(th)).toFixed(2) + " " + (top + h - h * Math.sin(th)).toFixed(2);
      }
      d += " Z";
      var spec = { x: 0, y: pageH };
      if (fill) spec.color = fill;
      if (stroke) {
        spec.borderColor = stroke;
        spec.borderWidth = thick || 1;
      }
      page.drawSvgPath(d, spec);
    }
    /* A tiny picture of a unit type, used in the schedule and legend. */
    function typeIconPdf(label, x, top, w, h) {
      if (label === "halfround") {
        pdfArch(x, top, w, h, GLASS, NAVY, 0.8);
        ln(x + w / 2, top + h * 0.15, x + w / 2, top + h, NAVY, 0.5);
        return;
      }
      rect(x, top, w, h, { fill: GLASS, stroke: NAVY, thickness: 0.8 });
      var cx = x + w / 2,
        cy = top + h / 2;
      if (label === "SH") {
        ln(x, cy, x + w, cy, NAVY, 0.8);
        ln(cx - 2, top + h * 0.34, cx, top + h * 0.16, BLUE, 0.7);
        ln(cx + 2, top + h * 0.34, cx, top + h * 0.16, BLUE, 0.7);
        ln(cx - 2, top + h * 0.66, cx, top + h * 0.84, BLUE, 0.7);
        ln(cx + 2, top + h * 0.66, cx, top + h * 0.84, BLUE, 0.7);
      } else if (label === "roller") {
        ln(cx, top, cx, top + h, NAVY, 0.8);
        ln(x + w * 0.3, top + h * 0.3, x + w * 0.16, cy, BLUE, 0.7);
        ln(x + w * 0.3, top + h * 0.7, x + w * 0.16, cy, BLUE, 0.7);
        ln(x + w * 0.7, top + h * 0.3, x + w * 0.84, cy, BLUE, 0.7);
        ln(x + w * 0.7, top + h * 0.7, x + w * 0.84, cy, BLUE, 0.7);
      } else if (label === "casement") {
        ln(x + w, top, x, cy, BLUE, 0.7);
        ln(x + w, top + h, x, cy, BLUE, 0.7);
      } else if (label === "swing") {
        var rr = Math.min(w * 0.9, h * 0.8);
        for (var i = 0; i < 8; i++) {
          var a0 = (Math.PI / 2) * (i / 8);
          var a1 = (Math.PI / 2) * ((i + 1) / 8);
          ln(x + rr * Math.sin(a0), top + h - rr * Math.cos(a0), x + rr * Math.sin(a1), top + h - rr * Math.cos(a1), BLUE, 0.7);
        }
      } else if (label === "sgd") {
        ln(x + w * 0.55, top, x + w * 0.55, top + h, NAVY, 0.8);
        ln(x + w * 0.18, cy, x + w * 0.42, cy, BLUE, 0.7);
        ln(x + w * 0.18, cy, x + w * 0.28, cy - h * 0.2, BLUE, 0.7);
        ln(x + w * 0.18, cy, x + w * 0.28, cy + h * 0.2, BLUE, 0.7);
      } else {
        rect(x + w * 0.16, top + h * 0.16, w * 0.68, h * 0.68, { stroke: rgb(0.55, 0.65, 0.75), thickness: 0.5 });
      }
    }
    /* Dimension line with end ticks and the value centred on it (horizontal or vertical). */
    function dimH(x1, x2, top, label, size, color) {
      ln(x1, top, x2, top, color, 0.7);
      ln(x1, top - 3, x1, top + 3, color, 0.7);
      ln(x2, top - 3, x2, top + 3, color, 0.7);
      var tw = textW(label, size, bold);
      rect((x1 + x2) / 2 - tw / 2 - 3, top - 5, tw + 6, 10, { fill: WHITE });
      write(label, (x1 + x2) / 2 - tw / 2, yOf(top + size / 3), size, bold, color);
    }
    function dimV(x, t1, t2, label, size, color) {
      ln(x, t1, x, t2, color, 0.7);
      ln(x - 3, t1, x + 3, t1, color, 0.7);
      ln(x - 3, t2, x + 3, t2, color, 0.7);
      var tw = textW(label, size, bold);
      var cy = (t1 + t2) / 2;
      rect(x - 5, cy - tw / 2 - 3, 10, tw + 6, { fill: WHITE });
      page.drawText(winAnsi(label), { x: x + size / 3, y: yOf(cy) - tw / 2, size: size, font: bold, color: color, rotate: degrees(90) });
    }
    function card(x, top, w, h, title) {
      page.drawRectangle({ x: x, y: yOf(top + h), width: w, height: h, borderColor: RULE, borderWidth: 0.8, color: WHITE });
      write(title, x + 8, yOf(top + 12), 7.5, bold, BLUE);
      ln(x + 8, top + 17, x + w - 8, top + 17, BLUE, 0.7);
    }

    /* ---------- title block and footer (white page, blue rules) ---------- */
    function sheetHeader(title, sub) {
      write(title, M, yOf(34), 16, bold, NAVY);
      write(sub, M, yOf(46), 7.5, font, MUTED);
      var lines = [];
      if (meta.job) lines.push("Job  " + meta.job);
      if (meta.client) lines.push(meta.client);
      if (meta.address) lines.push(meta.address);
      if (meta.mark) lines.push("Opening  " + meta.mark);
      lines.push(today);
      var yy = 20;
      lines.forEach(function (s, i) {
        writeR(fitStr(s, 300, 8, i === lines.length - 1 ? font : bold), pageW - M, yy, 8, i === lines.length - 1 ? font : bold, i === lines.length - 1 ? MUTED : NAVY);
        yy += 10;
      });
      page.drawRectangle({ x: M, y: yOf(60) - 1, width: pageW - M * 2, height: 2, color: BLUE });
    }
    function sheetFooter() {
      ln(M, pageH - 28, pageW - M, pageH - 28, BLUE, 0.8);
      write("Permit Toolkit  -  planning aid, not for construction", M, yOf(pageH - 16), 7.5, font, MUTED);
      writeC("Sheet " + sheetNo, pageW / 2, pageH - 16, 7.5, font, MUTED);
      writeR("Verify with manufacturer and AHJ.", pageW - M, pageH - 16, 7.5, font, MUTED);
    }
    var contentTop = 70;
    var contentBottom = pageH - 36;

    /* ---------- the elevation ---------- */
    function drawElevation(zx, ztop, zw, zh) {
      var dimPad = 26;
      var scale = Math.min((zw - dimPad * 2) / ow, (zh - dimPad * 2) / oh);
      var dW = ow * scale,
        dH = oh * scale;
      var ox = zx + (zw - dW) / 2;
      var oy = ztop + (zh - dH) / 2;
      if (layerOn("opening")) {
        dimH(ox, ox + dW, oy - 15, inchesText(ow) + '"', 9, BLUE);
        dimV(ox - 15, oy, oy + dH, inchesText(oh) + '"', 9, BLUE);
        ln(ox, oy - 2, ox, oy - 12, RULE, 0.5);
        ln(ox + dW, oy - 2, ox + dW, oy - 12, RULE, 0.5);
        ln(ox - 2, oy, ox - 12, oy, RULE, 0.5);
        ln(ox - 2, oy + dH, ox - 12, oy + dH, RULE, 0.5);
      }
      if (layerOn("bucks") || layerOn("opening"))
        rect(ox, oy, dW, dH, {
          fill: layerOn("bucks") ? rgb(0.8, 0.84, 0.88) : rgb(0.97, 0.97, 0.98),
          stroke: layerOn("opening") ? NAVY : undefined,
          thickness: layerOn("opening") ? 1.4 : 0,
        });
      var bx = ox + tBuck * scale,
        by = oy + tBuck * scale;
      if (layerOn("units")) rect(bx, by, flat.pocket.w * scale, flat.pocket.h * scale, { fill: rgb(0.93, 0.95, 0.98) });
      if (layerOn("units"))
        flat.gaps.forEach(function (g) {
          rect(bx + g.x * scale, by + g.y * scale, g.w * scale, g.h * scale, { fill: rgb(0.82, 0.84, 0.87) });
        });
      if (layerOn("units"))
        flat.units.forEach(function (u) {
          var ux = bx + u.x * scale,
            uy = by + u.y * scale,
            uw = u.w * scale,
            uh = u.h * scale;
          var inset = Math.min(6, uw * 0.08, uh * 0.08);
          if (u.label === "halfround") {
            pdfArch(ux, uy, uw, uh, WHITE, NAVY, 0.9);
            if (uw > 12 && uh > 12) pdfArch(ux + inset, uy + inset, Math.max(1, uw - inset * 2), Math.max(1, uh - inset), GLASS, rgb(0.55, 0.65, 0.75), 0.4);
          } else {
            rect(ux, uy, uw, uh, { fill: WHITE, stroke: NAVY, thickness: 0.9 });
            if (uw > 12 && uh > 12) {
              rect(ux + inset, uy + inset, Math.max(1, uw - inset * 2), Math.max(1, uh - inset * 2), {
                fill: GLASS,
                stroke: rgb(0.55, 0.65, 0.75),
                thickness: 0.4,
              });
              pdfSash(u.label, ux + inset, uy + inset, uw - inset * 2, uh - inset * 2);
            }
          }
          if (layerOn("ids") && uw > 26 && uh > 22) {
            /* mark badge (U1) top-left, type short name in the middle */
            var mk = "#" + u.index;
            var bw = textW(mk, 6.5, bold) + 6;
            rect(ux + inset + 3, uy + inset + 3, bw, 9, { fill: NAVY });
            write(mk, ux + inset + 6, yOf(uy + inset + 9.6), 6.5, bold, WHITE);
            var short = labelShort(u.label);
            var tsz = uh > 40 && uw > 60 ? 9 : 7;
            writeC(short, ux + uw / 2, uy + uh / 2 + tsz / 3, tsz, bold, NAVY);
          }
          if (layerOn("dims") && uw > 26 && uh > 22) {
            var dw = dimLabel(u, "w");
            var dh = dimLabel(u, "h");
            if (dw && uw > 44) {
              var tW = textW(dw, 7.5, bold);
              var lx1 = ux + inset + 6,
                lx2 = ux + uw - inset - 6;
              var ty = uy + inset + 13;
              ln(lx1, ty, lx2, ty, BLUE, 0.5);
              ln(lx1, ty - 2, lx1, ty + 2, BLUE, 0.5);
              ln(lx2, ty - 2, lx2, ty + 2, BLUE, 0.5);
              rect(ux + uw / 2 - tW / 2 - 2, ty - 4.5, tW + 4, 9, { fill: GLASS });
              write(dw, ux + uw / 2 - tW / 2, yOf(ty + 2.6), 7.5, bold, BLUE);
            }
            if (dh && uh > 44) {
              var tH = textW(dh, 7.5, bold);
              var hx = ux + inset + 6;
              var hy1 = uy + inset + 20,
                hy2 = uy + uh - inset - 6;
              ln(hx, hy1, hx, hy2, BLUE, 0.5);
              ln(hx - 2, hy1, hx + 2, hy1, BLUE, 0.5);
              ln(hx - 2, hy2, hx + 2, hy2, BLUE, 0.5);
              var hc = (hy1 + hy2) / 2;
              rect(hx - 4.5, hc - tH / 2 - 2, 9, tH + 4, { fill: GLASS });
              page.drawText(winAnsi(dh), { x: hx + 2.6, y: yOf(hc) - tH / 2, size: 7.5, font: bold, color: BLUE, rotate: degrees(90) });
            }
          }
        });
      /* Mullion names sit ON the bar (on a white tag), never inside the glass. */
      if (layerOn("mullions"))
        flat.mullions.forEach(function (m) {
          var mx = bx + m.x * scale,
            my = by + m.y * scale,
            mw = Math.max(m.w * scale, 1.4),
            mh = Math.max(m.h * scale, 1.4);
          rect(mx, my, mw, mh, { fill: rgb(0.12, 0.16, 0.23) });
          var along = m.axis === "v" ? mh : mw;
          if (layerOn("mullLabels") && along > 30) {
            var ml = "M-" + m.index + "  " + m.stock.nominal + "  " + formatIn(m.stock.tIn);
            var msz = 7;
            var mlw = textW(ml, msz, bold);
            if (m.axis === "v") {
              var cxm = mx + mw / 2;
              var cym = my + mh / 2;
              rect(cxm - 6, cym - mlw / 2 - 2, 12, mlw + 4, { fill: WHITE, stroke: RULE, thickness: 0.4 });
              page.drawText(winAnsi(ml), { x: cxm + 2.6, y: yOf(cym) - mlw / 2, size: msz, font: bold, color: NAVY, rotate: degrees(90) });
            } else {
              var lx = mx + mw / 2 - mlw / 2;
              var cyh = my + mh / 2;
              rect(lx - 3, cyh - 5.5, mlw + 6, 11, { fill: WHITE, stroke: RULE, thickness: 0.4 });
              write(ml, lx, yOf(cyh + 2.6), msz, bold, NAVY);
            }
          }
        });
      if (layerOn("opening")) rect(ox, oy, dW, dH, { stroke: NAVY, thickness: 1.4 });
      if (layerOn("bucks") && layerOn("mullLabels")) {
        /* The buck name sits on the frame itself, like the mullion names. */
        var bl = "B-1  " + state.buckStock.nominal + "  " + formatIn(state.buckStock.tIn);
        var blw = textW(bl, 7, bold);
        var blx = ox + Math.min(30, dW * 0.05);
        rect(blx - 3, oy + (tBuck * scale) / 2 - 5.5, blw + 6, 11, { fill: WHITE, stroke: RULE, thickness: 0.4 });
        write(bl, blx, yOf(oy + (tBuck * scale) / 2 + 2.6), 7, bold, NAVY);
      }
      return { ox: ox, oy: oy, dW: dW, dH: dH };
    }

    /* ---------- tables and cards ---------- */
    function unitTypeText(u) {
      var s = labelName(u.label);
      if (u.label === "halfround" && u.archBaseIndex) s += " on #" + u.archBaseIndex;
      return s;
    }
    /* Draws as many unit rows as fit, one row per unit, both W and H, never overlapping. Returns how many it drew. */
    function scheduleRows(x, top, w, h, units) {
      var cols = [x + 8, x + 8 + w * 0.12, x + 8 + w * 0.12 + 24, x + w * 0.66, x + w * 0.83];
      var headTop = top + 28;
      ["#", "", "Type", "W in", "H in"].forEach(function (hd, i) {
        if (hd) write(hd, cols[i], yOf(headTop), 7.5, bold, MUTED);
      });
      ln(x + 8, headTop + 4, x + w - 8, headTop + 4, RULE, 0.6);
      var rowsTop = headTop + 7;
      var avail = top + h - 6 - rowsTop;
      var rowH = Math.min(17, avail / Math.max(1, units.length));
      var fit = units.length;
      if (rowH < 10) {
        rowH = 10;
        fit = Math.max(0, Math.floor(avail / rowH));
      }
      var fs = rowH >= 15 ? 8.5 : rowH >= 12 ? 7.5 : 6.8;
      for (var i = 0; i < fit; i++) {
        var u = units[i];
        var t = rowsTop + i * rowH;
        if (i % 2 === 0) rect(x + 4, t, w - 8, rowH, { fill: rgb(0.96, 0.97, 0.99) });
        var base = yOf(t + rowH / 2 + fs / 3);
        write("#" + u.index, cols[0], base, fs, bold, NAVY);
        var ih = Math.min(rowH - 3, 11);
        typeIconPdf(u.label, cols[1], t + (rowH - ih) / 2, 18, ih);
        write(fitStr(unitTypeText(u), cols[3] - cols[2] - 6, fs, bold), cols[2], base, fs, bold, NAVY);
        write(fitStr(dimLabel(u, "w") || "-", cols[4] - cols[3] - 4, fs, font), cols[3], base, fs, font, INK);
        write(fitStr(dimLabel(u, "h") || "-", x + w - 8 - cols[4], fs, font), cols[4], base, fs, font, INK);
      }
      return fit;
    }
    function mullionRows(x, top, w, h, list) {
      var rowH = 11.5;
      var perCol = Math.max(1, Math.floor((top + h - 6 - (top + 26)) / rowH));
      var ncol = list.length > perCol && w >= 230 ? 2 : 1;
      var fit = Math.min(list.length, perCol * ncol);
      var colW = (w - 8) / ncol;
      for (var i = 0; i < fit; i++) {
        var m = list[i];
        var cx = x + 8 + Math.floor(i / perCol) * colW;
        var t = top + 26 + (i % perCol) * rowH;
        write("M-" + m.index, cx, yOf(t + 8), 8, bold, NAVY);
        write(m.stock.nominal + "  " + formatIn(m.stock.tIn), cx + 24, yOf(t + 8), 8, font, INK);
        write(m.axis === "v" ? "vert" : "horiz", cx + colW * (ncol === 2 ? 0.66 : 0.62) - 8, yOf(t + 8), 8, font, MUTED);
      }
      if (list.length === 0) write("None.", x + 8, yOf(top + 34), 8, font, MUTED);
      return fit;
    }
    function summaryCard(x, top, w, h) {
      card(x, top, w, h, "OPENING");
      var t = top + 34;
      write(inchesText(ow) + " x " + inchesText(oh) + " in", x + 8, yOf(t), 13, bold, NAVY);
      t += 16;
      write("B-1  BUCKS  " + state.buckStock.nominal + "  " + formatIn(state.buckStock.tIn) + " all around", x + 8, yOf(t), 8.5, font, INK);
      t += 12;
      write("POCKET  " + formatIn(flat.pocket.w) + " x " + formatIn(flat.pocket.h), x + 8, yOf(t), 8.5, font, INK);
      t += 15;
      /* legend: the unit types used on this sheet */
      var seen = {};
      var used = [];
      flat.units.forEach(function (u) {
        if (!seen[u.label]) {
          seen[u.label] = 1;
          used.push(u.label);
        }
      });
      if (used.length && t + 24 < top + h) {
        write("TYPES", x + 8, yOf(t), 7, bold, MUTED);
        t += 5;
        used.forEach(function (lab) {
          if (t + 14 > top + h) return;
          typeIconPdf(lab, x + 8, t, 18, 10);
          write(labelName(lab), x + 32, yOf(t + 8), 7.5, font, INK);
          t += 13;
        });
      }
    }
    function planCard(x, top, w, h) {
      card(x, top, w, h, "FLOOR PLAN");
      if (!planPng) {
        write("Floor plan picture not provided.", x + 8, yOf(top + 34), 7.5, font, MUTED);
        return;
      }
      var aw = w - 16,
        ah = h - 26;
      var r = Math.min(aw / planPng.width, ah / planPng.height);
      var dw = planPng.width * r,
        dh = planPng.height * r;
      var px = x + (w - dw) / 2;
      var pt = top + 22 + (ah - dh) / 2;
      page.drawImage(planPng, { x: px, y: yOf(pt + dh), width: dw, height: dh });
    }

    var planPng = null;
    if (planImage) {
      try {
        planPng = await pdf.embedPng(planImage);
      } catch (planErr) {
        planPng = null;
      }
    }

    /* ---------- page 1: layout adapts to the shape of the opening ---------- */
    sheetHeader("ENGINEER LAYOUT", "Window wall elevation  -  planning aid, not for construction");
    var overflowUnits = [];
    var overflowMulls = [];
    var wide = ow / oh >= 1.45;
    if (wide) {
      /* Wide wall: elevation across the full width, schedules in a row underneath. */
      var bottomH = 176;
      var elevH = Math.min(contentBottom - contentTop - bottomH - 10, 320);
      var zoneW = pageW - M * 2;
      drawElevation(M, contentTop, zoneW, elevH);
      var rowTop = contentTop + elevH + 10;
      var rowH2 = contentBottom - rowTop;
      var c1 = 170,
        c3 = 250;
      var c2 = zoneW - c1 - c3 - 20;
      summaryCard(M, rowTop, c1, rowH2);
      card(M + c1 + 10, rowTop, c2, rowH2, "UNIT SCHEDULE");
      var drawn = flat.units.length ? scheduleRows(M + c1 + 10, rowTop, c2, rowH2, flat.units) : 0;
      if (!flat.units.length) write("No units placed.", M + c1 + 18, yOf(rowTop + 34), 8, font, MUTED);
      overflowUnits = flat.units.slice(drawn);
      var x3 = M + c1 + c2 + 20;
      var mullH = Math.min(rowH2 * 0.42, 26 + Math.max(1, flat.mullions.length) * 11.5 + 6);
      card(x3, rowTop, c3, mullH, "MULLIONS");
      var mdrawn = mullionRows(x3, rowTop, c3, mullH, flat.mullions);
      overflowMulls = flat.mullions.slice(mdrawn);
      planCard(x3, rowTop + mullH + 8, c3, rowH2 - mullH - 8);
    } else {
      /* Tall or square opening: elevation on the left, schedules stacked on the right. */
      var rightW = 262;
      var zoneW2 = pageW - M * 2 - rightW - 14;
      drawElevation(M, contentTop, zoneW2, contentBottom - contentTop);
      var rx = pageW - M - rightW;
      var sumH = 104;
      summaryCard(rx, contentTop, rightW, sumH);
      var planH = planPng ? 150 : 0;
      var mullH2 = Math.min(90, 26 + Math.max(1, flat.mullions.length) * 11.5 + 6);
      var schedTop = contentTop + sumH + 8;
      var schedH = contentBottom - schedTop - (planH ? planH + 8 : 0) - mullH2 - 8;
      card(rx, schedTop, rightW, schedH, "UNIT SCHEDULE");
      var drawn2 = flat.units.length ? scheduleRows(rx, schedTop, rightW, schedH, flat.units) : 0;
      if (!flat.units.length) write("No units placed.", rx + 8, yOf(schedTop + 34), 8, font, MUTED);
      overflowUnits = flat.units.slice(drawn2);
      var mTop = schedTop + schedH + 8;
      card(rx, mTop, rightW, mullH2, "MULLIONS");
      var md2 = mullionRows(rx, mTop, rightW, mullH2, flat.mullions);
      overflowMulls = flat.mullions.slice(md2);
      if (planH) planCard(rx, mTop + mullH2 + 8, rightW, planH);
    }
    sheetFooter();

    /* ---------- more units than fit: continue the schedule on more pages, same style ---------- */
    while (overflowUnits.length > 0 || overflowMulls.length > 0) {
      page = pdf.addPage([792, 612]);
      sheetNo += 1;
      sheetHeader("ENGINEER LAYOUT", "Unit schedule (continued)");
      var cardH = contentBottom - contentTop;
      if (overflowUnits.length > 0) {
        card(M, contentTop, pageW - M * 2, cardH, "UNIT SCHEDULE (CONTINUED)");
        var d3 = scheduleRows(M, contentTop, pageW - M * 2, cardH, overflowUnits);
        overflowUnits = overflowUnits.slice(Math.max(1, d3));
      } else {
        card(M, contentTop, pageW - M * 2, cardH, "MULLIONS (CONTINUED)");
        var d4 = mullionRows(M, contentTop, pageW - M * 2, cardH, overflowMulls);
        overflowMulls = overflowMulls.slice(Math.max(1, d4));
      }
      sheetFooter();
    }

    /* ---------- the floor plan's window and door schedule, with the house plan drawn large beside it ---------- */
    function floorScheduleRows(x, top, w, h, rows) {
      var cols = [x + 8, x + 34, x + w * 0.5, x + w * 0.64, x + w * 0.76];
      var headTop = top + 28;
      ["#", "Type", "W in", "H in", "Location"].forEach(function (hd, i) {
        write(hd, cols[i], yOf(headTop), 7.5, bold, MUTED);
      });
      ln(x + 8, headTop + 4, x + w - 8, headTop + 4, RULE, 0.6);
      var rowsTop = headTop + 7;
      var avail = top + h - 6 - rowsTop;
      var rh = Math.min(17, avail / Math.max(1, rows.length));
      var fit = rows.length;
      if (rh < 11) {
        rh = 11;
        fit = Math.max(1, Math.floor(avail / rh));
      }
      var fs = rh >= 15 ? 8.5 : 7.5;
      for (var i = 0; i < fit; i++) {
        var r = rows[i];
        var t = rowsTop + i * rh;
        var isCur = floorCurrent != null && Number(r.n) === Number(floorCurrent);
        if (isCur) rect(x + 4, t, w - 8, rh, { fill: rgb(0.86, 0.92, 1) });
        else if (i % 2 === 0) rect(x + 4, t, w - 8, rh, { fill: rgb(0.96, 0.97, 0.99) });
        var base = yOf(t + rh / 2 + fs / 3);
        var fnt = isCur ? bold : font;
        write("#" + r.n, cols[0], base, fs, bold, NAVY);
        write(fitStr(r.type || "", cols[2] - cols[1] - 4, fs, fnt), cols[1], base, fs, fnt, INK);
        write(fitStr(r.w === "" || r.w == null ? "-" : inchesText(Number(r.w)), cols[3] - cols[2] - 4, fs, fnt), cols[2], base, fs, fnt, INK);
        write(fitStr(r.h === "" || r.h == null ? "-" : inchesText(Number(r.h)), cols[4] - cols[3] - 4, fs, fnt), cols[3], base, fs, fnt, INK);
        write(fitStr(r.loc || "", x + w - 8 - cols[4], fs, fnt), cols[4], base, fs, fnt, INK);
      }
      return fit;
    }
    if (floorSchedule && floorSchedule.length) {
      var rest2 = floorSchedule.slice();
      var firstSched = true;
      while (rest2.length > 0 || firstSched) {
        page = pdf.addPage([792, 612]);
        sheetNo += 1;
        sheetHeader("OPENING SCHEDULE", "From the floor plan  -  every window and door with its size and type");
        var fh = contentBottom - contentTop;
        var fx = M;
        var fw = pageW - M * 2;
        if (firstSched && planPng) {
          var pw2 = 440;
          planCard(M, contentTop, pw2, fh);
          fx = M + pw2 + 10;
          fw = pageW - M - fx;
        }
        card(fx, contentTop, fw, fh, "WINDOW & DOOR SCHEDULE");
        var dn = floorScheduleRows(fx, contentTop, fw, fh, rest2);
        rest2 = rest2.slice(Math.max(1, dn));
        firstSched = false;
        sheetFooter();
      }
    }

    var bytes = await pdf.save();
    var ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    var blob = new Blob([ab], { type: "application/pdf" });
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(blob);
    var name = "window-wall-" + new Date().toISOString().slice(0, 10) + ".pdf";
    $("wwPdfFrame").src = pdfUrl;
    $("wwSave").href = pdfUrl;
    $("wwSave").setAttribute("download", name);
    $("wwOpen").href = pdfUrl;
    $("wwPdf").classList.add("open");
    } catch (err) {
      console.error(err);
      alert("Could not create the PDF: " + ((err && err.message) || "try Save after the preview opens"));
    }
  }

  document.addEventListener(
    "pointerdown",
    function (e) {
      var t = e.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || typeof t.closest !== "function") return;
      var btn = t.closest("[data-act]");
      if (!btn || btn.getAttribute("data-act") !== "pdf") return;
      e.preventDefault();
      makePdf();
    },
    true
  );

  $("wwPrint").onclick = function () {
    if (!pdfUrl) {
      makePdf();
      return;
    }
    var w = window.open(pdfUrl, "_blank");
    if (w) {
      setTimeout(function () {
        try {
          w.focus();
          w.print();
        } catch (err) {}
      }, 600);
    } else if ($("wwSave") && $("wwSave").href) {
      $("wwSave").click();
    }
  };
  $("wwPdfClose").onclick = function () {
    $("wwPdf").classList.remove("open");
  };

  /* ---------- embedded in the floor plan editor (Engineer layout) ----------
     The editor sends the saved layout and a small picture of the house plan; this page sends the layout
     back whenever it changes. Same origin only. */
  function restoreState(s) {
    var base = initialState();
    if (!s || typeof s !== "object" || !s.tree || !s.opening) return base;
    return {
      opening: {
        wIn: Math.max(1, Number(s.opening.wIn) || base.opening.wIn),
        hIn: Math.max(1, Number(s.opening.hIn) || base.opening.hIn),
        wRaw: s.opening.wRaw != null ? String(s.opening.wRaw) : base.opening.wRaw,
        hRaw: s.opening.hRaw != null ? String(s.opening.hRaw) : base.opening.hRaw,
      },
      buckStock: stockById(s.buckStock && s.buckStock.id),
      mullionStock: stockById(s.mullionStock && s.mullionStock.id),
      tree: s.tree,
    };
  }
  var notifyTimer = null;
  function notifyParent() {
    if (window.parent === window) return;
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(function () {
      try {
        window.parent.postMessage(
          { source: "paio-window-wall", type: "ww:state", state: JSON.parse(JSON.stringify(state)) },
          window.location.origin
        );
      } catch (err) {}
    }, 250);
  }
  var baseRender = render;
  render = function () {
    baseRender();
    notifyParent();
  };
  window.addEventListener("message", function (e) {
    if (e.origin !== window.location.origin) return;
    var d = e.data;
    if (!d || typeof d !== "object" || d.source !== "paio-floor-plan") return;
    if (d.type === "ww:load") {
      if (d.planImage) planImage = d.planImage;
      if (d.meta && typeof d.meta === "object") sheetMeta = d.meta;
      if (Array.isArray(d.schedule)) floorSchedule = d.schedule;
      if (d.current != null) floorCurrent = d.current;
      if (d.state) {
        state = restoreState(d.state);
        selection = null;
        past = [];
      }
      render();
    } else if (d.type === "ww:plan") {
      planImage = d.planImage || null;
      if (d.meta && typeof d.meta === "object") sheetMeta = d.meta;
      if (Array.isArray(d.schedule)) floorSchedule = d.schedule;
      if (d.current != null) floorCurrent = d.current;
    } else if (d.type === "ww:pdf") {
      makePdf();
    }
  });
  try {
    if (window.parent !== window) window.parent.postMessage({ source: "paio-window-wall", type: "ww:ready" }, window.location.origin);
  } catch (err) {}

  /* kick */
  if (document.readyState === "complete") render();
  else window.addEventListener("load", function () {
    setTimeout(render, 50);
  });
  setTimeout(render, 200);
  if (window.ResizeObserver && $("wwCanvasWrap")) {
    new ResizeObserver(function () {
      draw();
    }).observe($("wwCanvasWrap"));
  }
})();
