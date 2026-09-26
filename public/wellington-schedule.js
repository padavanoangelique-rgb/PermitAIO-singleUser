(function () {
  if (window.__wellingtonScheduleInstalled) return;
  window.__wellingtonScheduleInstalled = true;

  function jobId() {
    try {
      return new URLSearchParams(location.search).get("job_id") || "";
    } catch (e) {
      return "";
    }
  }

  function selectedIsWellington(sel) {
    if (!sel) return false;
    var value = String(sel.value || "").toLowerCase();
    var label = String((sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || "").toLowerCase();
    return value === "wellington" || /wellington/.test(value) || /wellington/.test(label);
  }

  function floorPlanTabActive() {
    var tab = document.getElementById("tab-floorplan");
    return !tab || tab.classList.contains("active");
  }

  function restoreFloorPlan() {
    var view = document.getElementById("view-floorplan");
    if (view) view.style.display = "flex";
  }

  function parseDp(text) {
    var m = String(text || "").match(/([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)/);
    if (!m) return { pos: "", neg: "" };
    return { pos: m[1], neg: m[2] };
  }

  function formatPsf(v, asNeg) {
    if (v === null || v === undefined || v === "") return "";
    var n = Number(String(v).replace(/^[+]/, "").replace(/psf/i, "").trim());
    if (!isFinite(n)) return String(v);
    var abs = Math.abs(n);
    var body = Math.abs(abs - Math.round(abs)) < 0.001 ? String(Math.round(abs)) : String(Math.round(abs * 100) / 100);
    if (asNeg || n < 0) return "-" + body;
    return "+" + body;
  }

  function openingsFromDom() {
    if (typeof window.__paioGetOpenings === "function") {
      try {
        var fromPlan = window.__paioGetOpenings();
        if (Array.isArray(fromPlan) && fromPlan.length) return fromPlan;
      } catch (e) {}
    }
    return Array.from(document.querySelectorAll("#table-scroll .win-row")).map(function (row) {
      function val(field) {
        var el = row.querySelector('[data-field="' + field + '"]');
        return el ? el.value : "";
      }
      var zoneEl = row.querySelector(".zone-toggle input:checked");
      var egress = row.querySelector(".egress-row-toggle input:checked");
      var bs = row.querySelectorAll(".product-ref b");
      var noa = ((bs[0] || {}).textContent || "").trim();
      if (noa === "-") noa = "";
      var dp = parseDp((bs[1] || {}).textContent || "");
      return {
        type: val("type"),
        width: val("width"),
        height: val("height"),
        zone: zoneEl ? zoneEl.value : val("zone"),
        egress: Boolean(egress),
        productApproval: noa || val("productApproval") || val("series"),
        manufacturer: val("manufacturer"),
        series: val("series"),
        pressurePos: val("pressurePos") || dp.pos,
        pressureNeg: val("pressureNeg") || dp.neg,
        designPos: val("designPos"),
        designNeg: val("designNeg"),
      };
    });
  }

  function ensureOption() {
    var sel = document.getElementById("schedule-jurisdiction");
    if (!sel) return null;
    var existing = Array.from(sel.options).find(function (o) {
      return /wellington/i.test(o.value + " " + o.text);
    });
    if (existing) {
      existing.value = "wellington";
      existing.textContent = "Village of Wellington";
      return sel;
    }
    var opt = document.createElement("option");
    opt.value = "wellington";
    opt.textContent = "Village of Wellington";
    sel.appendChild(opt);
    return sel;
  }

  function renderPreview(panel) {
    var list = openingsFromDom();
    var box = panel.querySelector("#wellington-preview");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = "<p>No openings on this floor plan yet. Pick Manufacturer + Series so product-approval pressures print.</p>";
      return;
    }
    var rows = list.map(function (o, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + (o.type || "") + "</td><td>" + (o.width || "") + " x " + (o.height || "") + "</td><td>" + (o.zone || "") + "</td><td>" + (o.productApproval || "") + "</td><td>" + (formatPsf(o.pressurePos, false) || "-") + "</td><td>" + (formatPsf(o.pressureNeg, true) || "-") + "</td></tr>";
    }).join("");
    box.innerHTML =
      "<p>These openings fill the official Wellington worksheet. Product-approval +/− PSF print on the form.</p>" +
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' +
      "<th align=left>#</th><th align=left>Type</th><th align=left>W x H</th><th align=left>Zone</th><th align=left>FL#</th>" +
      "<th align=left>Approved +</th><th align=left>Approved -</th></tr></thead><tbody>" +
      rows + "</tbody></table>";
  }

  function ensureView() {
    var panel = document.getElementById("view-wellington");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "view-wellington";
      panel.style.display = "none";
      panel.innerHTML =
        '<div class="schedule-col" style="padding:24px 28px;max-width:920px">' +
        "<p style=\"margin:0 0 12px;font-size:14px;line-height:1.45\">Village of Wellington only accepts their official Window / Door / Shutter Worksheet. Product-approval +/− PSF print in the Pressures listed on Product Approval columns.</p>" +
        '<button id="wellington-official-pdf-btn" class="pdf-btn" type="button">Download Official Wellington Worksheet</button>' +
        '<div id="wellington-preview" style="margin-top:16px"></div></div>';
      var sched = document.getElementById("view-schedule");
      if (sched && sched.parentNode) sched.parentNode.insertBefore(panel, sched.nextSibling);
      else document.body.appendChild(panel);
    }
    var btn = document.getElementById("wellington-official-pdf-btn");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", downloadOfficial);
    }
    return panel;
  }

  function markGroupTabActive(on) {
    var groupBtn = document.getElementById("tab-schedule-group");
    if (groupBtn) groupBtn.classList.toggle("active", on);
  }

  function sync() {
    var sel = document.getElementById("schedule-jurisdiction");
    var panel = ensureView();
    if (floorPlanTabActive()) {
      panel.style.display = "none";
      restoreFloorPlan();
      return;
    }
    var on = selectedIsWellington(sel);
    panel.style.display = on ? "block" : "none";
    if (on) {
      renderPreview(panel);
      markGroupTabActive(true);
    }
  }

  async function downloadOfficial() {
    var id = jobId();
    if (!id) {
      alert("Open this floor plan from a job and add openings first.");
      return;
    }
    var openings = openingsFromDom();
    var missingDp = openings.filter(function (o) {
      return o.pressurePos === "" || o.pressurePos == null || o.pressureNeg === "" || o.pressureNeg == null;
    }).length;
    if (openings.length && missingDp === openings.length) {
      var proceed = confirm("None of these openings have product-approval pressures yet. Pick Manufacturer + Series on the Floor Plan tab, or print required DP only?");
      if (!proceed) return;
    }
    var res = await fetch("/api/wellington-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: id,
        openings: openings,
        address: (document.getElementById("pi-address") || {}).value || "",
        clientName: (document.getElementById("pi-name") || {}).value || "",
        roofHeightFt: Number((document.getElementById("pi-roofheight") || {}).value) || undefined,
      }),
    });
    if (res.status === 503) {
      alert("The official Wellington worksheet PDF is missing from public/templates.");
      return;
    }
    if (!res.ok) {
      alert("Could not fill the Wellington worksheet.");
      return;
    }
    var blob = await res.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Wellington-Window-Door-Worksheet.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function boot() {
    var sel = ensureOption();
    ensureView();
    if (!sel) return;
    if (!sel.dataset.wellingtonBound) {
      sel.dataset.wellingtonBound = "1";
      sel.addEventListener("change", sync);
    }
    var floorTab = document.getElementById("tab-floorplan");
    if (floorTab && !floorTab.dataset.wellingtonBound) {
      floorTab.dataset.wellingtonBound = "1";
      floorTab.addEventListener("click", sync);
    }
    var schedTab = document.getElementById("tab-schedule");
    if (schedTab && !schedTab.dataset.wellingtonBound) {
      schedTab.dataset.wellingtonBound = "1";
      schedTab.addEventListener("click", sync);
    }
    var groupTab = document.getElementById("tab-schedule-group");
    if (groupTab && !groupTab.dataset.wellingtonBound) {
      groupTab.dataset.wellingtonBound = "1";
      groupTab.addEventListener("click", sync);
    }
    var city = (document.getElementById("pi-address") || {}).value || "";
    if (/wellington/i.test(city) && sel.value !== "wellington") sel.value = "wellington";
    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 400);
})();
