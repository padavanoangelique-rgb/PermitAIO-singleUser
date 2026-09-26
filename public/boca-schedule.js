(function () {
  if (window.__bocaScheduleInstalled) return;
  window.__bocaScheduleInstalled = true;

  function jobId() {
    try {
      return new URLSearchParams(location.search).get("job_id") || "";
    } catch {
      return "";
    }
  }

  async function downloadOfficial() {
    const id = jobId();
    if (!id) {
      alert("Open this floor plan from a job so the official Boca form can fill.");
      return;
    }
    const res = await fetch("/api/boca-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: id }),
    });
    if (res.status === 503) {
      alert("Official Boca template is not on the server yet. Add public/templates/boca-window-door-schedule.pdf and redeploy.");
      return;
    }
    if (!res.ok) {
      alert("Could not fill the Boca schedule.");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Boca-Raton-Window-Door-Schedule.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function hook() {
    const sel = document.getElementById("schedule-jurisdiction");
    if (!sel) return;
    const btn = document.getElementById("boca-official-pdf-btn");
    if (btn) return;
    const official = document.createElement("button");
    official.id = "boca-official-pdf-btn";
    official.type = "button";
    official.className = "pdf-btn";
    official.textContent = "Download Official Boca Schedule";
    official.style.display = sel.value === "boca" ? "" : "none";
    official.addEventListener("click", downloadOfficial);
    const toolbar = document.querySelector("#view-boca .schedule-toolbar") || document.getElementById("floorplan-toolbar");
    if (toolbar) toolbar.appendChild(official);
    else document.body.appendChild(official);
    sel.addEventListener("change", () => {
      official.style.display = sel.value === "boca" ? "" : "none";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  else hook();
  setTimeout(hook, 400);
  setTimeout(hook, 1200);
})();
