(function () {
if (window.__paioGridColorV5) return;
window.__paioGridColorV5 = true;

function isLight() {
return document.documentElement.getAttribute("data-theme") !== "dark";
}

function isGridBlue(v) {
if (typeof v !== "string") return false;
return v.replace(/\s/g, "").indexOf("127,212,255") !== -1;
}

// Light mode: soft app-accent blue grid on the light-grey canvas.
// Dark mode: unchanged lime-on-navy, matching the rest of the dark UI.
function colorFor(v) {
var s = String(v).replace(/\s/g, "");
var light = isLight();
if (s.indexOf("0.4") !== -1) return light ? "rgba(37,99,235,0.65)" : "rgba(200,240,77,0.40)";
if (s.indexOf("0.2") !== -1) return light ? "rgba(37,99,235,0.35)" : "rgba(200,240,77,0.22)";
return light ? "rgba(37,99,235,0.14)" : "rgba(200,240,77,0.08)";
}

var proto = CanvasRenderingContext2D.prototype;
var origStroke = proto.stroke;
var origFillText = proto.fillText;
proto.stroke = function () {
if (isGridBlue(this.strokeStyle)) this.strokeStyle = colorFor(this.strokeStyle);
return origStroke.apply(this, arguments);
};
proto.fillText = function () {
if (isGridBlue(this.fillStyle)) this.fillStyle = colorFor(this.fillStyle);
return origFillText.apply(this, arguments);
};
})();
