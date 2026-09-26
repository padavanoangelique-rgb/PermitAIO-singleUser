(function () {
  if (window.__paioCadPdfInstalled) return;
  window.__paioCadPdfInstalled = true;

  function val(id) {
    const el = document.getElementById(id);
    return el && el.value ? String(el.value).trim() : "";
  }
  function param(k) {
    try {
      return new URLSearchParams(location.search).get(k) || "";
    } catch (e) {
      return "";
    }
  }
  function ensureFields() {
    ["pi-pcn", "pi-job"].forEach(function (id) {
      if (document.getElementById(id)) return;
      const input = document.createElement("input");
      input.type = "hidden";
      input.id = id;
      document.body.appendChild(input);
    });
    const pcn = document.getElementById("pi-pcn");
    const job = document.getElementById("pi-job");
    if (pcn && !pcn.value) pcn.value = param("job_folio") || param("folio") || "";
    if (job && !job.value) job.value = param("job_number") || param("job_client") || "";
  }

  function drawCadChrome(doc) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = 18;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.1);
    doc.rect(m, m, pageW - m * 2, pageH - m * 2);
    doc.setLineWidth(0.35);
    doc.rect(m + 3, m + 3, pageW - m * 2 - 6, pageH - m * 2 - 6);

    const name = val("pi-name") || param("job_client");
    const addr = val("pi-address") || param("job_address");
    const pcn = val("pi-pcn") || param("job_folio");
    const jobNo = val("pi-job") || param("job_number");
    const date = new Date().toLocaleDateString();

    doc.setFillColor(255, 255, 255);
    doc.rect(m + 4, m + 4, pageW - m * 2 - 8, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("WINDOW & DOOR FLOOR PLAN", m + 10, m + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const bits = [];
    if (name) bits.push("OWNER  " + name);
    if (addr) bits.push("ADDRESS  " + addr);
    if (pcn) bits.push("PCN  " + pcn);
    if (jobNo) bits.push("JOB  " + jobNo);
    bits.push("SCALE  NTS");
    bits.push("DATE  " + date);
    doc.text(bits.join("    |    "), m + 10, m + 27);
  }

  function hookJsPdf() {
    const ns = window.jspdf;
    if (!ns || !ns.jsPDF) return false;
    const proto = ns.jsPDF.API || ns.jsPDF.prototype;
    if (!proto || proto.__paioText) return true;
    proto.__paioText = proto.text;
    // Reentrancy guard: drawCadChrome() itself calls doc.text(...) (for the
    // title-block strings), which passes back through this very wrapper.
    // Without this flag, any path that causes drawCadChrome to run again
    // while already inside it recurses forever ("Maximum call stack size
    // exceeded"), which aborts PDF generation before .save() is ever
    // reached — the reported "Floor Plan PDF doesn't download" bug.
    let inChrome = false;
    proto.text = function (text) {
      if (!inChrome && text === "Floor Plan") {
        inChrome = true;
        try {
          drawCadChrome(this);
        } finally {
          inChrome = false;
        }
        return this;
      }
      if (!inChrome && typeof text === "string" && text.indexOf("Homeowner:") !== -1) {
        return this;
      }
      return proto.__paioText.apply(this, arguments);
    };
    return true;
  }

  function boot() {
    ensureFields();
    if (!hookJsPdf()) setTimeout(boot, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 200);
  setTimeout(boot, 1200);
})();
  setTimeout(boot, 200);
  setTimeout(boot, 1200);
})();
