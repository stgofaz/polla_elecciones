// ---- FRONTEND ADMIN ----

let CANDIDATES = [];

function parsePercentValue(raw) {
  if (!raw) return NaN;
  const normalized = raw.toString().replace(",", ".");
  return parseFloat(normalized);
}

function formatScore(score) {
  if (score == null || isNaN(score) || !isFinite(score)) return "—";
  return score.toFixed(3);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCandidatesAdmin();
  setupRealInputs();
  await loadRealValues();
  await loadRanking();

  const saveBtn = document.getElementById("save-real-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveReal);
  }

  const downloadBtn = document.getElementById("download-excel-btn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      window.location.href = "/api/admin/download-excel";
    });
  }

  const resetBtn = document.getElementById("reset-excel-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (
        !confirm(
          "¿Seguro que quieres reiniciar el Excel? Se borrarán todas las participaciones."
        )
      ) {
        return;
      }
      try {
        const resp = await fetch("/api/admin/reset-excel", { method: "DELETE" });
        if (!resp.ok) throw new Error("Error al resetear Excel");
        const msg = document.getElementById("admin-msg");
        msg.textContent = "Excel reiniciado correctamente.";
        await loadRanking();
      } catch (err) {
        console.error(err);
        const msg = document.getElementById("admin-msg");
        msg.textContent = "Error al reiniciar Excel.";
      }
    });
  }
});

async function loadCandidatesAdmin() {
  try {
    const resp = await fetch("/api/candidates");
    if (!resp.ok) throw new Error("Error al obtener candidatos");
    const data = await resp.json();
    CANDIDATES = data.candidates || [];
  } catch (err) {
    console.error("Error candidatos admin", err);
    CANDIDATES = [];
  }
}

function setupRealInputs() {
  const container = document.getElementById("real-inputs");
  if (!container) return;
  container.innerHTML = "";

  CANDIDATES.forEach((name) => {
    const row = document.createElement("div");
    row.className = "candidate-row";

    const label = document.createElement("div");
    label.className = "candidate-name";
    label.textContent = name;

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "percent-input-wrapper";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.className = "percent-input";
    input.placeholder = "Real 0,0";
    input.dataset.candidate = name;

    const suffix = document.createElement("span");
    suffix.className = "percent-suffix";
    suffix.textContent = "%";

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(suffix);

    row.appendChild(label);
    row.appendChild(inputWrapper);
    container.appendChild(row);
  });
}

async function loadRealValues() {
  try {
    const resp = await fetch("/api/admin/real");
    if (!resp.ok) return;
    const data = await resp.json();
    const real = data.real || {};

    document
      .querySelectorAll("#real-inputs .percent-input")
      .forEach((input) => {
        const cand = input.dataset.candidate;
        const val = real[cand];
        if (typeof val === "number" && !isNaN(val)) {
          input.value = val.toFixed(1).replace(".", ",");
        }
      });
  } catch (err) {
    console.error("Error al cargar reales", err);
  }
}

async function handleSaveReal() {
  const real = {};
  document
    .querySelectorAll("#real-inputs .percent-input")
    .forEach((input) => {
      const cand = input.dataset.candidate;
      const raw = input.value.trim();
      const num = parsePercentValue(raw);
      if (!isNaN(num)) {
        real[cand] = num;
      }
    });

  try {
    const resp = await fetch("/api/admin/real", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ real })
    });
    if (!resp.ok) throw new Error("Error al guardar reales");
    const msg = document.getElementById("admin-msg");
    msg.textContent = "Porcentajes reales guardados y ranking recalculado.";
    await loadRanking();
  } catch (err) {
    console.error(err);
    const msg = document.getElementById("admin-msg");
    msg.textContent = "Error al guardar reales.";
  }
}

async function loadRanking() {
  try {
    const resp = await fetch("/api/admin/ranking");
    if (!resp.ok) return;
    const data = await resp.json();
    const ranking = data.ranking || [];
    renderRankingTable(ranking);
  } catch (err) {
    console.error("Error al cargar ranking", err);
  }
}

function renderRankingTable(ranking) {
  const tbody = document.querySelector("#ranking-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!ranking.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No hay participantes o aún no hay resultados reales.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  ranking.forEach((item) => {
    const tr = document.createElement("tr");
    const tdPos = document.createElement("td");
    const tdName = document.createElement("td");
    const tdScore = document.createElement("td");

    tdPos.textContent = item.position;

    let displayName = item.name || "";
    if (item.isLast) {
      displayName += " (Carlalí)";
    }
    tdName.textContent = displayName;

    tdScore.textContent = formatScore(item.score);

    tr.appendChild(tdPos);
    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tbody.appendChild(tr);
  });
}
