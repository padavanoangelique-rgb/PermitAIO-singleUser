/* Miami-Dade County: adds a "Download Official Miami-Dade Schedule" button that fills the
   county's own Uniform Retrofit Window & Door Schedule form from this job's openings.
   The Miami-Dade wind load chart / auto-calc is untouched -- this only changes the PDF form. */
(function () {
  if (window.__miamiScheduleInstalled) return;
  window.__miamiScheduleInstalled = true;

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
      alert("Open this floor plan from a job so the official Miami-Dade form can fill.");
      return;
    }
    var res = await fetch("/api/miami-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: id }),
    });
    if (res.status === 503) {
      alert("Official Miami-Dade template is not on the server yet. Add public/templates/miami-dade-window-door-schedule.pdf and redeploy.");
      return;
    }
    if (!res.ok) {
      alert("Could not fill the Miami-Dade schedule.");
      return;
    }
    var blob = await res.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Miami-Dade-County-Window-Door-Schedule.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function hook() {
    var sel = document.getElementById("schedule-jurisdiction");
    if (!sel) return;
    var btn = document.getElementById("miami-official-pdf-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "miami-official-pdf-btn";
      btn.type = "button";
      btn.className = "pdf-btn";
      btn.textContent = "Download Official Miami-Dade Schedule";
      btn.addEventListener("click", downloadOfficial);
      var toolbar = document.querySelector("#view-miami .schedule-toolbar") || document.getElementById("floorplan-toolbar");
      if (toolbar) toolbar.appendChild(btn);
      else document.body.appendChild(btn);
      sel.addEventListener("change", hook);
    }
    btn.style.display = sel.value === "miami" ? "" : "none";
    /* The official form replaces the old generated Miami PDF. */
    var old = document.getElementById("miami-pdf-btn");
    if (old) old.style.display = "none";
  }

  hook();
  window.setInterval(hook, 1500);
})();
