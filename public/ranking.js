// ---- FRONTEND RANKING PÚBLICO ----

let CANDIDATES = [];
let REAL_VALUES = {};

// Hora de disclosure (ajústala si quieres)
const DISCLOSURE_TIME = new Date("2025-11-16T16:00:00-03:00");

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
  await loadCandidates();
  await loadRealValues();
  await fetchAndRenderResults();
  updateDisclosureDisplay();

  // refresco automático cada 60 segundos
  setInterval(async () => {
    await loadRealValues();
    await fetchAndRenderResults();
    updateDisclosureDisplay();
  }, 60000);
});

async function loadCandidates() {
  try {
    const resp = await fetch("/api/candidates");
    if (!resp.ok) throw new Error("Error al obtener candidatos");
    const data = await resp.json();
    CANDIDATES = data.candidates || [];
  } catch (err) {
    console.error("Error candidatos ranking", err);
    CANDIDATES = [];
  }
}

async function loadRealValues() {
  try {
    const resp = await fetch("/api/admin/real");
    if (!resp.ok) return;
    const data = await resp.json();
    REAL_VALUES = data.real || {};
  } catch (err) {
    console.error("Error al cargar reales (ranking)", err);
    REAL_VALUES = {};
  }
}

async function fetchAndRenderResults() {
  try {
    const resp = await fetch("/api/results");
    if (!resp.ok) {
      console.error("Error al obtener resultados");
      return;
    }
    const json = await resp.json();
    const header = json.header || [];
    const rows = json.rows || [];
    renderResultsTable(header, rows);
  } catch (err) {
    console.error("Error al llamar /api/results", err);
  }
}

function renderResultsTable(header, rows) {
  const table = document.getElementById("results-table");
  if (!table) return;

  table.innerHTML = "";

  if (!rows.length) {
    const msgRow = document.createElement("tr");
    const msgCell = document.createElement("td");
    msgCell.colSpan = CANDIDATES.length + 2; // nombre + puntaje
    msgCell.textContent = "Todavía no hay participantes registrados.";
    msgCell.style.padding = "0.7rem 0.4rem";
    msgRow.appendChild(msgCell);
    table.appendChild(msgRow);
    return;
  }

  const usedHeader =
    header && header.length >= CANDIDATES.length + 1
      ? header
      : ["Participante", ...CANDIDATES];

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  usedHeader.forEach((colName) => {
    const th = document.createElement("th");
    th.textContent = colName;
    headRow.appendChild(th);
  });
  const thScore = document.createElement("th");
  thScore.textContent = "Puntaje";
  headRow.appendChild(thScore);
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");

  // Construimos participantes con score
  const participants = rows.map((row) => {
    const name = row[0] || "";
    const values = usedHeader.slice(1).map((colName, idx) => {
      const raw = row[idx + 1];
      const num = parsePercentValue(raw);
      return num;
    });

    let sumSquares = 0;
    let hasAny = false;
    CANDIDATES.forEach((cand, idx) => {
      const pred = values[idx];
      const realVal = REAL_VALUES[cand];
      if (!isNaN(pred) && typeof realVal === "number" && !isNaN(realVal)) {
        const diff = pred - realVal;
        sumSquares += diff * diff;
        hasAny = true;
      }
    });

    let score;
    if (!hasAny) {
      score = Number.POSITIVE_INFINITY;
    } else {
      score = Math.sqrt(sumSquares);
    }

    return { name, values, score };
  });

  // Ordenar por score ascendente
  participants.sort((a, b) => {
    if (!isFinite(a.score) && !isFinite(b.score)) return 0;
    if (!isFinite(a.score)) return 1;
    if (!isFinite(b.score)) return -1;
    return a.score - b.score;
  });

  // Índice del peor score finito
  let lastIndex = -1;
  for (let i = participants.length - 1; i >= 0; i--) {
    if (isFinite(participants[i].score)) {
      lastIndex = i;
      break;
    }
  }

  // ¿Hay resultados reales?
  let hasReal = false;
  for (const cand of CANDIDATES) {
    const v = REAL_VALUES[cand];
    if (typeof v === "number" && !isNaN(v)) {
      hasReal = true;
      break;
    }
  }

  // Fila de resultados reales
  if (hasReal) {
    const trReal = document.createElement("tr");
    trReal.classList.add("real-row");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = "Resultados reales";
    trReal.appendChild(tdLabel);

    usedHeader.slice(1).forEach((cand) => {
      const td = document.createElement("td");
      const realVal = REAL_VALUES[cand];
      if (typeof realVal === "number" && !isNaN(realVal)) {
        td.textContent = realVal.toFixed(1).replace(".", ",") + " %";
      } else {
        td.textContent = "";
      }
      td.classList.add("candidate-value-cell");
      trReal.appendChild(td);
    });

    const tdScoreReal = document.createElement("td");
    tdScoreReal.textContent = "—";
    tdScoreReal.classList.add("candidate-value-cell");
    trReal.appendChild(tdScoreReal);

    tbody.appendChild(trReal);
  }

  // Filas de participantes
  participants.forEach((p, idx) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    let displayName = p.name || "";
    if (idx === lastIndex && isFinite(p.score)) {
      displayName += " (Carlalí)";
    }
    tdName.textContent = displayName;
    tdName.style.fontWeight = "600";
    tdName.style.color = "#0b3b7a";
    tr.appendChild(tdName);

    usedHeader.slice(1).forEach((cand, i) => {
      const td = document.createElement("td");
      const num = p.values[i];
      if (!isNaN(num)) {
        td.textContent = num.toFixed(1).replace(".", ",") + " %";
      } else {
        td.textContent = "";
      }
      td.classList.add("candidate-value-cell");
      tr.appendChild(td);
    });

    const tdScore = document.createElement("td");
    tdScore.textContent = formatScore(p.score);
    tdScore.classList.add("candidate-value-cell");
    tr.appendChild(tdScore);

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  updateDisclosureDisplay();
}

function updateDisclosureDisplay() {
  const now = new Date();
  const overlay = document.getElementById("results-overlay");
  const cells = document.querySelectorAll(".candidate-value-cell");
  if (!overlay) return;

  if (now >= DISCLOSURE_TIME) {
    overlay.style.display = "none";
    cells.forEach((td) => td.classList.remove("cell-blurred"));
  } else {
    overlay.style.display = "flex";
    cells.forEach((td) => td.classList.add("cell-blurred"));
  }
}
