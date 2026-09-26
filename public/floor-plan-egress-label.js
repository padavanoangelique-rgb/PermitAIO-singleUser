(function () {
  if (window.__paioEgressLabelInstalled) return;
  window.__paioEgressLabelInstalled = true;

  function typeOf(row) {
    const el = row && row.querySelector('[data-field="type"]');
    return el ? String(el.value || "") : "";
  }
  function numField(row, field) {
    const el = row && row.querySelector('[data-field="' + field + '"]');
    return el ? Number(el.value) : 0;
  }
  function computeFromRow(row) {
    const w = numField(row, "width");
    const h = numField(row, "height");
    if (!w || !h) return null;
    const t = typeOf(row).toLowerCase();
    var sqft = null;
    if (t.indexOf("single hung") >= 0 || t.indexOf("double hung") >= 0) sqft = ((h / 2) - 4) * w / 144;
    else if (t.indexOf("slider") >= 0 || t.indexOf("horizontal roller") >= 0) sqft = ((w / 2) - 4) * h / 144;
    else if (t.indexOf("casement") >= 0) sqft = (w - 4) * h / 144;
    if (sqft === null) return null;
    return Math.max(0, sqft).toFixed(2);
  }
  function rowByNum(n) {
    return Array.from(document.querySelectorAll("#table-scroll .win-row")).find(function (row) {
      const el = row.querySelector(".num");
      return el && String(el.textContent).trim() === String(n);
    });
  }

  var lastNumAtX = {};
  var proto = CanvasRenderingContext2D.prototype;
  if (proto.__paioFillText) return;
  proto.__paioFillText = proto.fillText;
  proto.fillText = function (text, x, y, maxWidth) {
    if (typeof text === "number" || (typeof text === "string" && /^\d+$/.test(text))) {
      lastNumAtX[Math.round(x)] = String(text);
    }
    if (text === "EGRESS") {
      const n = lastNumAtX[Math.round(x)];
      const sq = n ? computeFromRow(rowByNum(n)) : null;
      if (sq) text = "EGRESS " + sq;
    }
    if (arguments.length >= 4) return proto.__paioFillText.call(this, text, x, y, maxWidth);
    return proto.__paioFillText.call(this, text, x, y);
  };
})();
