/* Palm Beach County: adds a "Download Official Palm Beach Schedule" button that fills the
   county's own Uniform Retrofit Window & Door Schedule form from this job's openings. */
(function () {
  if (window.__pbcScheduleInstalled) return;
  window.__pbcScheduleInstalled = true;

  function jobId() {
    try {
      return new URLSearchParams(location.search).get("job_id") || "";
    } catch (e) {
      return "";
    }
  }

  async function downloadOfficial() {
    var id = jobId();
    if (!id) {
      alert("Open this floor plan from a job so the official Palm Beach form can fill.");
      return;
    }
    var res = await fetch("/api/pbc-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: id }),
    });
    if (res.status === 503) {
      alert("Official Palm Beach template is not on the server yet. Add public/templates/pbc-window-door-schedule.pdf and redeploy.");
      return;
    }
    if (!res.ok) {
      alert("Could not fill the Palm Beach schedule.");
      return;
    }
    var blob = await res.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Palm-Beach-County-Window-Door-Schedule.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function hook() {
    var sel = document.getElementById("schedule-jurisdiction");
    if (!sel) return;
    var btn = document.getElementById("pbc-official-pdf-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "pbc-official-pdf-btn";
      btn.type = "button";
      btn.className = "pdf-btn";
      btn.textContent = "Download Official Palm Beach Schedule";
      btn.addEventListener("click", downloadOfficial);
      var toolbar = document.querySelector("#view-pbc .schedule-toolbar") || document.getElementById("floorplan-toolbar");
      if (toolbar) toolbar.appendChild(btn);
      else document.body.appendChild(btn);
      sel.addEventListener("change", hook);
    }
    btn.style.display = sel.value === "pbc" ? "" : "none";
    /* The official form replaces the old generated Palm Beach PDF. */
    var old = document.getElementById("pbc-pdf-btn");
    if (old) old.style.display = "none";
  }

  hook();
  window.setInterval(hook, 1500);
})();
