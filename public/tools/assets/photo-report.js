/* Permit Toolkit — Photo Report */
(function () {
  "use strict";

  var photos = [];
  var pdfUrl = null;
  var busy = false;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function uid() {
    return "p_" + Math.random().toString(36).slice(2, 9);
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function nextNum() {
    if (!photos.length) return 1;
    return Math.max.apply(
      null,
      photos.map(function (p) {
        return p.number;
      })
    ) + 1;
  }
  function winAnsi(s) {
    return String(s || "")
      .replace(/[×✕✖]/g, "x")
      .replace(/[—–−]/g, "-")
      .replace(/[′’‘]/g, "'")
      .replace(/[″“”]/g, '"')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
  }

  $("prDate").value = today();

  function readBuffer(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        resolve(r.result);
      };
      r.onerror = reject;
      r.readAsArrayBuffer(blob);
    });
  }
  function dataUrlToU8(data) {
    var bin = atob(String(data).split(",")[1] || "");
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function isJpeg(u8) {
    return u8 && u8.length > 4 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
  }
  function isPng(u8) {
    return u8 && u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
  }
  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }
  function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(function () {
          return createImageBitmap(file);
        })
        .catch(function () {
          return decodeViaImg(file);
        });
    }
    return decodeViaImg(file);
  }
  function canvasBytes(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      function fromDataUrl() {
        try {
          resolve(dataUrlToU8(canvas.toDataURL(type, quality)));
        } catch (err) {
          reject(err);
        }
      }
      if (!canvas.toBlob) return fromDataUrl();
      canvas.toBlob(
        function (blob) {
          if (!blob) return fromDataUrl();
          readBuffer(blob).then(
            function (ab) {
              resolve(new Uint8Array(ab));
            },
            function () {
              fromDataUrl();
            }
          );
        },
        type,
        quality
      );
    });
  }
  function fileToJpeg(file) {
    return decodeImage(file).then(function (img) {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (!iw || !ih) throw new Error("empty");
      var max = 1600;
      var scale = Math.min(1, max / Math.max(iw, ih));
      var w = Math.max(1, Math.round(iw * scale));
      var h = Math.max(1, Math.round(ih * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      if (img.close) try { img.close(); } catch (e) {}
      return canvasBytes(canvas, "image/jpeg", 0.86).then(function (jpeg) {
        var preview = canvas.toDataURL("image/jpeg", 0.72);
        if (isJpeg(jpeg)) return { jpeg: jpeg, png: null, w: w, h: h, url: preview };
        return canvasBytes(canvas, "image/png").then(function (png) {
          return { jpeg: null, png: png, w: w, h: h, url: canvas.toDataURL("image/png") };
        });
      });
    });
  }

  var inbound = [];
  var draining = false;
  var keepShoot = true;
  try {
    var savedKeep = localStorage.getItem("pt_pr_keep_shoot");
    if (savedKeep === "0") keepShoot = false;
  } catch (e) {}

  function currentRoom() {
    var el = $("prRoomNext");
    return el ? String(el.value || "").trim() : "";
  }
  function openCamera() {
    var input = $("prCamInput");
    if (!input) return;
    input.value = "";
    input.click();
  }
  function addFiles(list, fromCamera) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) {
      if (!f) return false;
      var t = String(f.type || "").toLowerCase();
      var n = String(f.name || "").toLowerCase();
      if (!t || t.indexOf("image/") === 0) return true;
      return /\.(heic|heif|jpe?g|png|webp|gif|bmp)$/.test(n);
    });
    if (!files.length) return;
    inbound = inbound.concat(files);
    drainQueue();
  }
  function drainQueue() {
    if (draining) return;
    draining = true;
    var n = nextNum();
    function step() {
      if (!inbound.length) {
        draining = false;
        render();
        var listEl = $("prList");
        if (listEl) listEl.scrollTop = listEl.scrollHeight;
        return;
      }
      var file = inbound.shift();
      fileToJpeg(file)
        .then(function (j) {
          photos.push({
            id: uid(),
            number: n++,
            room: currentRoom(),
            note: "",
            jpeg: j.jpeg,
            png: j.png,
            w: j.w,
            h: j.h,
            url: j.url,
          });
          render();
          var listEl = $("prList");
          if (listEl) listEl.scrollTop = listEl.scrollHeight;
        })
        .catch(function () {
          render("Could not read that photo. Try Camera again, or a JPEG from the library.");
        })
        .then(step);
    }
    step();
  }

  function render(err) {
    var list = $("prList");
    if (!photos.length) {
      list.innerHTML =
        '<div class="pr-empty"><b>Take the first photo</b>Rear camera, then keep shooting. Set Next room so every shot is tagged.</div>' +
        (err ? '<p class="pr-err">' + err + "</p>" : "");
      $("prPdf").disabled = true;
      return;
    }
    $("prPdf").disabled = false;
    var html = "";
    photos.forEach(function (p, i) {
      html +=
        '<article class="pr-card" data-id="' +
        p.id +
        '"><div class="pr-thumb"><img src="' +
        p.url +
        '" alt=""><span class="pr-num">' +
        String(p.number).padStart(2, "0") +
        '</span></div><div class="pr-fields"><div class="pr-row">' +
        '<input type="number" min="1" value="' +
        p.number +
        '" data-k="number" aria-label="Number">' +
        '<input list="prRooms" placeholder="Room location" value="' +
        String(p.room).replace(/"/g, "") +
        '" data-k="room" aria-label="Room">' +
        '<button type="button" class="pr-icon" data-act="up"' +
        (i === 0 ? " disabled" : "") +
        ">↑</button>" +
        '<button type="button" class="pr-icon" data-act="down"' +
        (i === photos.length - 1 ? " disabled" : "") +
        ">↓</button>" +
        '<button type="button" class="pr-icon" data-act="del">✕</button>' +
        "</div>" +
        '<textarea data-k="note" placeholder="Note — existing window, damage, HOA condition…">' +
        String(p.note).replace(/</g, "") +
        "</textarea></div></article>";
    });
    if (err) html += '<p class="pr-err">' + err + "</p>";
    list.innerHTML = html;
    list.querySelectorAll("[data-k]").forEach(function (el) {
      el.addEventListener("change", onField);
      el.addEventListener("input", onField);
    });
    list.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", onAct);
    });
  }

  function findCard(el) {
    var n = el;
    while (n && !n.getAttribute("data-id")) n = n.parentElement;
    if (!n) return -1;
    var id = n.getAttribute("data-id");
    for (var i = 0; i < photos.length; i++) if (photos[i].id === id) return i;
    return -1;
  }
  function onField(e) {
    var i = findCard(e.target);
    if (i < 0) return;
    var k = e.target.getAttribute("data-k");
    if (k === "number") {
      var n = parseInt(e.target.value, 10);
      if (n > 0) photos[i].number = n;
    } else photos[i][k] = e.target.value;
  }
  function onAct(e) {
    var i = findCard(e.currentTarget);
    if (i < 0) return;
    var act = e.currentTarget.getAttribute("data-act");
    if (act === "del") {
      if (photos[i].url && photos[i].url.indexOf("blob:") === 0) URL.revokeObjectURL(photos[i].url);
      photos.splice(i, 1);
      photos.forEach(function (p, idx) {
        p.number = idx + 1;
      });
    } else if (act === "up" && i > 0) {
      var t = photos[i];
      photos[i] = photos[i - 1];
      photos[i - 1] = t;
      photos.forEach(function (p, idx) {
        p.number = idx + 1;
      });
    } else if (act === "down" && i < photos.length - 1) {
      var t2 = photos[i];
      photos[i] = photos[i + 1];
      photos[i + 1] = t2;
      photos.forEach(function (p, idx) {
        p.number = idx + 1;
      });
    }
    render();
  }

  async function makePdf() {
    if (!photos.length) return render("Add at least one photo.");
    if (!window.PDFLib) return render("PDF library still loading — try again.");
    if (busy) return;
    busy = true;
    $("prPdf").disabled = true;
    try {
      var PDFDocument = PDFLib.PDFDocument;
      var StandardFonts = PDFLib.StandardFonts;
      var rgb = PDFLib.rgb;
      var pdf = await PDFDocument.create();
      var font = await pdf.embedFont(StandardFonts.Helvetica);
      var bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      var pageW = 612,
        pageH = 792;
      var NAVY = rgb(0.043, 0.122, 0.227);
      var BLUE = rgb(0.145, 0.388, 0.922);
      var INK = rgb(0.05, 0.08, 0.12);
      var MUTED = rgb(0.35, 0.4, 0.48);
      var CREAM = rgb(1, 1, 1);
      function write(page, text, x, y, size, fnt, color) {
        page.drawText(winAnsi(text), { x: x, y: y, size: size, font: fnt || font, color: color || INK });
      }
      function headerBar(page, sub) {
        page.drawRectangle({ x: 0, y: pageH - 44, width: pageW, height: 44, color: NAVY });
        write(page, "PHOTO REPORT", 24, pageH - 20, 13, bold, CREAM);
        write(page, sub, 24, pageH - 34, 8, font, BLUE);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: 22, color: NAVY });
        write(page, "Permit Toolkit  -  permittoolkit.com", 24, 8, 8, font, CREAM);
      }
      var job = $("prJob").value.trim() || "Untitled job";
      var addr = $("prAddr").value.trim() || "No address";
      var date = $("prDate").value || today();
      var by = $("prBy").value.trim() || "—";
      var sorted = photos.slice().sort(function (a, b) {
        return a.number - b.number;
      });
      var cover = pdf.addPage([pageW, pageH]);
      headerBar(cover, "Existing conditions / field photos");
      write(cover, job, 24, pageH - 88, 20, bold, NAVY);
      write(cover, addr, 24, pageH - 110, 12, font, MUTED);
      write(cover, "Date", 24, pageH - 140, 8, bold, BLUE);
      write(cover, date, 24, pageH - 156, 12, bold, NAVY);
      write(cover, "Taken by", 220, pageH - 140, 8, bold, BLUE);
      write(cover, by, 220, pageH - 156, 12, bold, NAVY);
      write(cover, "Photos", 400, pageH - 140, 8, bold, BLUE);
      write(cover, String(sorted.length), 400, pageH - 156, 12, bold, NAVY);
      write(cover, "INDEX", 24, pageH - 196, 9, bold, BLUE);
      cover.drawLine({
        start: { x: 24, y: pageH - 204 },
        end: { x: pageW - 24, y: pageH - 204 },
        thickness: 0.8,
        color: BLUE,
      });
      write(cover, "#", 24, pageH - 220, 8, bold, MUTED);
      write(cover, "Room", 56, pageH - 220, 8, bold, MUTED);
      write(cover, "Note", 220, pageH - 220, 8, bold, MUTED);
      var y = pageH - 238;
      sorted.forEach(function (p, i) {
        if (y < 48) return;
        if (i % 2 === 0)
          cover.drawRectangle({ x: 20, y: y - 6, width: pageW - 40, height: 18, color: rgb(0.96, 0.97, 0.99) });
        write(cover, String(p.number).padStart(2, "0"), 24, y, 9, bold, NAVY);
        write(cover, (p.room || "—").slice(0, 28), 56, y, 9);
        write(cover, (p.note || "").slice(0, 52), 220, y, 8, font, MUTED);
        y -= 18;
      });
      async function embedPhoto(p) {
        if (p.jpeg && isJpeg(p.jpeg)) {
          try {
            return await pdf.embedJpg(p.jpeg);
          } catch (err) {}
        }
        if (p.png && isPng(p.png)) {
          try {
            return await pdf.embedPng(p.png);
          } catch (err) {}
        }
        if (p.url && p.url.indexOf("data:image/jpeg") === 0) {
          var j = dataUrlToU8(p.url);
          if (isJpeg(j)) return await pdf.embedJpg(j);
        }
        if (p.url && p.url.indexOf("data:image/png") === 0) {
          return await pdf.embedPng(dataUrlToU8(p.url));
        }
        throw new Error("Photo " + p.number + " could not be embedded");
      }
      for (var i = 0; i < sorted.length; i++) {
        var p = sorted[i];
        var page = pdf.addPage([pageW, pageH]);
        headerBar(page, "Photo " + String(p.number).padStart(2, "0") + " of " + sorted.length);
        var img = await embedPhoto(p);
        var capH = 64;
        var boxW = pageW - 32;
        var boxH = pageH - 44 - 22 - capH - 12;
        var boxY = 22 + capH;
        var sc = Math.min(boxW / img.width, boxH / img.height);
        var dw = Math.max(1, img.width * sc);
        var dh = Math.max(1, img.height * sc);
        page.drawRectangle({ x: 16, y: boxY, width: boxW, height: boxH, color: rgb(0.93, 0.94, 0.96) });
        page.drawImage(img, {
          x: 16 + (boxW - dw) / 2,
          y: boxY + (boxH - dh) / 2,
          width: dw,
          height: dh,
        });
        page.drawRectangle({ x: 16, y: 28, width: 48, height: 24, color: NAVY });
        write(page, String(p.number).padStart(2, "0"), 26, 34, 12, bold, CREAM);
        write(page, (p.room && p.room.trim()) || "Unassigned room", 74, 34, 12, bold, NAVY);
        write(page, ((p.note && p.note.trim()) || "No note").slice(0, 110), 16, 54, 10, font, MUTED);
      }
      var bytes = await pdf.save();
      var ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      var blob = new Blob([ab], { type: "application/pdf" });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      pdfUrl = URL.createObjectURL(blob);
      $("prFrame").src = pdfUrl;
      $("prSave").href = pdfUrl;
      $("prSave").setAttribute("download", "photo-report-" + date + ".pdf");
      $("prOverlay").classList.add("open");
    } catch (e) {
      console.error(e);
      render("PDF failed: " + ((e && e.message) || "try a JPEG or PNG") + ".");
    }
    busy = false;
    $("prPdf").disabled = false;
  }

  $("prCam").onclick = function () {
    openCamera();
  };
  $("prLib").onclick = function () {
    $("prLibInput").click();
  };
  function bindCam(id) {
    var el = $(id);
    if (!el) return;
    el.onchange = function () {
      if (this.files && this.files.length) addFiles(this.files, true);
      this.value = "";
      if (keepShoot) {
        var next = id === "prCamInput" ? "prCamInput2" : "prCamInput";
        var other = $(next);
        if (other) {
          other.value = "";
          other.click();
        }
      }
    };
  }
  bindCam("prCamInput");
  bindCam("prCamInput2");
  $("prLibInput").onchange = function () {
    if (this.files && this.files.length) addFiles(this.files, false);
    this.value = "";
  };
  if ($("prKeep")) {
    $("prKeep").checked = keepShoot;
    $("prKeep").onchange = function () {
      keepShoot = !!this.checked;
      try {
        localStorage.setItem("pt_pr_keep_shoot", keepShoot ? "1" : "0");
      } catch (e) {}
    };
  }
  if ($("prJobBox") && window.matchMedia && window.matchMedia("(min-width:720px)").matches) {
    $("prJobBox").open = true;
  }
  $("prPdf").onclick = function (e) {
    e.preventDefault();
    makePdf();
  };
  $("prPrint").onclick = function () {
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
      }, 700);
    } else if ($("prSave") && $("prSave").href) {
      $("prSave").click();
    }
  };
  $("prClose").onclick = function () {
    $("prOverlay").classList.remove("open");
  };
  $("prList").addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".pr-empty")) $("prCamInput").click();
  });
  render();
})();
