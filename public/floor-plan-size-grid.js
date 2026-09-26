(function () {
  if (window.__paioSizeGridV2) return;
  window.__paioSizeGridV2 = true;

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[paio-grid]");
    console.log.apply(console, args);
  }

  var lastSig = "";
  var raf = 0;

  function zoneLabel(winRow) {
    var checked = winRow.querySelector(".zone-toggle input:checked");
    var v = checked ? checked.value : "";
    if (v === "5-End" || v === "5") return "5";
    if (v === "4-Inter" || v === "4") return "4";
    return v || "";
  }

  function text(sel, root) {
    var el = root.querySelector(sel);
    if (!el) return "";
    if (el.tagName === "SELECT") {
      var opt = el.options[el.selectedIndex];
      return (opt && opt.textContent ? opt.textContent : el.value || "").trim();
    }
    return String(el.value || el.textContent || "").trim();
  }

  function openingsFromPanel() {
    return Array.from(document.querySelectorAll("#table-scroll .win-row")).map(function (row, idx) {
      var typeEl = row.querySelector('[data-field="type"]');
      return {
        row: row,
        id: row.dataset.id,
        num: idx + 1,
        width: text('[data-field="width"]', row),
        height: text('[data-field="height"]', row),
        type: typeEl ? typeEl.value : "",
        zone: zoneLabel(row),
        selected: row.classList.contains("selected"),
      };
    });
  }

  function signature(list) {
    return list
      .map(function (i) {
        return [i.id, i.width, i.height, i.type, i.zone, i.selected ? "1" : "0"].join(":");
      })
      .join("|");
  }

  function lockPanel() {
    var panel = document.getElementById("floorplan-panel");
    if (panel) {
      panel.classList.add("collapsed");
      panel.style.setProperty("width", "0", "important");
      panel.style.setProperty("min-width", "0", "important");
      panel.style.setProperty("max-width", "0", "important");
      panel.style.setProperty("overflow", "hidden", "important");
      panel.style.setProperty("opacity", "0", "important");
      panel.style.setProperty("pointer-events", "none", "important");
    }
    var btn = document.getElementById("panel-collapse-btn");
    if (btn) btn.remove();
  }

  function selectOpening(row) {
    var selectBtn = document.getElementById("tool-select");
    if (selectBtn && !selectBtn.classList.contains("active")) selectBtn.click();
    if (row) row.click();
  }

  function setField(row, field, value) {
    var input = row.querySelector('[data-field="' + field + '"]');
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setZone(row, zoneVal) {
    var input = row.querySelector('.zone-toggle input[value="' + zoneVal + '"]');
    if (!input) return;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.click();
  }

  function ensureGrid() {
    var wrap = document.getElementById("paio-size-grid");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "paio-size-grid";
      wrap.innerHTML =
        '<div class="paio-size-head">Openings — click type or 4 / 5</div>' +
        '<button type="button" id="paio-open-spreadsheet-btn" class="paio-spreadsheet-btn">Open all as spreadsheet</button>' +
        '<div class="paio-size-scroll"><table class="paio-size-table"><thead><tr>' +
        "<th>#</th><th>W</th><th>H</th><th>Type</th><th>Zn</th>" +
        '</tr></thead><tbody id="paio-size-body"></tbody></table></div>';
      log("created grid");
    }
    var host = document.querySelector("#view-floorplan .canvas-wrap") || document.querySelector(".canvas-wrap") || document.body;
    if (wrap.parentNode !== host) host.appendChild(wrap);
    var openBtn = document.getElementById("paio-open-spreadsheet-btn");
    if (openBtn && !openBtn.dataset.bound) {
      openBtn.dataset.bound = "1";
      openBtn.addEventListener("click", function () {
        var mainBtn = document.getElementById("open-full-editor-btn");
        if (mainBtn) mainBtn.click();
      });
    }
    return wrap;
  }

  function render() {
    lockPanel();
    var wrap = ensureGrid();
    var body = document.getElementById("paio-size-body");
    if (!body) {
      log("no tbody");
      return;
    }
    var typingInGrid = document.activeElement && wrap.contains(document.activeElement);
    if (typingInGrid) return;
    var list = openingsFromPanel();
    var sig = signature(list);
    if (sig !== lastSig) {
      lastSig = sig;
      log("render", list.length);
      body.innerHTML = "";
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="5" class="paio-size-empty">Drop windows on the plan.</td></tr>';
      } else {
        var frag = document.createDocumentFragment();
        list.forEach(function (item) {
          var tr = document.createElement("tr");
          if (item.selected) tr.className = "is-selected";

          var num = document.createElement("td");
          num.className = "paio-num";
          num.textContent = String(item.num);
          num.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            selectOpening(item.row);
          });

          var wtd = document.createElement("td");
          var w = document.createElement("input");
          w.className = "paio-size-input";
          w.setAttribute("data-field", "width");
          w.value = item.width || "";
          w.setAttribute("inputmode", "numeric");
          w.addEventListener("input", function () {
            setField(item.row, "width", w.value);
          });
          wtd.appendChild(w);

          var htd = document.createElement("td");
          var h = document.createElement("input");
          h.className = "paio-size-input";
          h.setAttribute("data-field", "height");
          h.value = item.height || "";
          h.setAttribute("inputmode", "numeric");
          h.addEventListener("input", function () {
            setField(item.row, "height", h.value);
          });
          htd.appendChild(h);

          var typeTd = document.createElement("td");
          var srcType = item.row.querySelector('select[data-field="type"]');
          var typeSel = document.createElement("select");
          typeSel.className = "paio-type-select";
          if (srcType) {
            Array.from(srcType.options).forEach(function (opt) {
              var o = document.createElement("option");
              o.value = opt.value;
              o.textContent = opt.textContent;
              typeSel.appendChild(o);
            });
            typeSel.value = srcType.value;
          }
          typeSel.addEventListener("change", function () {
            setField(item.row, "type", typeSel.value);
          });
          typeTd.appendChild(typeSel);

          var znTd = document.createElement("td");
          znTd.className = "paio-zone-cell";
          ["4-Inter", "5-End"].forEach(function (val) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "paio-zone-btn" + ((val === "5-End" ? item.zone === "5" : item.zone === "4") ? " on" : "");
            btn.textContent = val === "5-End" ? "5" : "4";
            btn.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              e.stopPropagation();
              setZone(item.row, val);
            });
            znTd.appendChild(btn);
          });

          tr.appendChild(num);
          tr.appendChild(wtd);
          tr.appendChild(htd);
          tr.appendChild(typeTd);
          tr.appendChild(znTd);
          frag.appendChild(tr);
        });
        body.appendChild(frag);
      }
    }
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      render();
    });
  }

  function boot() {
    log("boot", document.readyState);
    lockPanel();
    ensureGrid();
    render();
    var scroll = document.getElementById("table-scroll");
    if (scroll && !scroll.dataset.paioObs) {
      scroll.dataset.paioObs = "1";
      new MutationObserver(schedule).observe(scroll, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "value"],
      });
    }
    var canvas = document.getElementById("canvas");
    if (canvas && !canvas.dataset.paioGridClick) {
      canvas.dataset.paioGridClick = "1";
      canvas.addEventListener(
        "pointerup",
        function () {
          setTimeout(schedule, 0);
          setTimeout(schedule, 120);
        },
        true,
      );
    }
    if (!window.__paioGridPoll) {
      window.__paioGridPoll = setInterval(render, 400);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 250);
})();
