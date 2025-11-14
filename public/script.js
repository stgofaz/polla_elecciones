// ---- FRONTEND PÚBLICO (flujo de participación) ----

let CANDIDATES = [];

// Estado simple
let participantName = "";
let projections = {};

// Utilidades
function parsePercentValue(raw) {
  if (!raw) return NaN;
  const normalized = raw.toString().replace(",", ".");
  return parseFloat(normalized);
}

function formatPercent(value) {
  if (isNaN(value)) return "0.0 %";
  return `${value.toFixed(1)} %`;
}

function calculateTotal(projectionsObj) {
  return Object.values(projectionsObj).reduce((sum, v) => {
    const num = typeof v === "number" ? v : parsePercentValue(v);
    if (isNaN(num)) return sum;
    return sum + num;
  }, 0);
}

function goToStep(stepNumber) {
  document.querySelectorAll(".step").forEach((el) => {
    el.classList.remove("active-step");
  });
  const stepEl = document.getElementById(`step-${stepNumber}`);
  if (stepEl) stepEl.classList.add("active-step");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCandidates();
  setupCandidatesGrid();
  setupStepHandlers();
});

async function loadCandidates() {
  try {
    const resp = await fetch("/api/candidates");
    if (!resp.ok) throw new Error("Error al obtener candidatos");
    const data = await resp.json();
    CANDIDATES = data.candidates || [];
  } catch (err) {
    console.error(err);
    CANDIDATES = [];
  }
}

function setupCandidatesGrid() {
  const container = document.getElementById("candidates-container");
  if (!container) return;
  container.innerHTML = "";
  projections = {};

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
    input.placeholder = "0,0";
    input.dataset.candidate = name;
    input.addEventListener("input", handlePercentChange);

    const suffix = document.createElement("span");
    suffix.className = "percent-suffix";
    suffix.textContent = "%";

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(suffix);

    row.appendChild(label);
    row.appendChild(inputWrapper);
    container.appendChild(row);

    projections[name] = 0;
  });

  updateTotalLabel();
}

function setupStepHandlers() {
  // Paso 1
  const step1NextBtn = document.getElementById("step1-next");
  const nameInput = document.getElementById("nombre-participante");
  const step1Error = document.getElementById("step1-error");

  if (step1NextBtn) {
    step1NextBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        step1Error.textContent = "Por favor, escribe tu nombre para continuar.";
        return;
      }
      step1Error.textContent = "";
      participantName = name;
      const resumen = document.getElementById("nombre-resumen");
      if (resumen) resumen.textContent = `Hola, ${participantName}`;
      goToStep(2);
    });
  }

  // Paso 2
  const step2BackBtn = document.getElementById("step2-back");
  const step2NextBtn = document.getElementById("step2-next");
  const step2Warning = document.getElementById("step2-warning");

  if (step2BackBtn) {
    step2BackBtn.addEventListener("click", () => goToStep(1));
  }

  if (step2NextBtn) {
    step2NextBtn.addEventListener("click", () => {
      const inputs = document.querySelectorAll(".percent-input");
      let allValid = true;
      let anyFilled = false;

      inputs.forEach((input) => {
        const value = input.value.trim();
        const num = parsePercentValue(value);
        if (value !== "") anyFilled = true;
        if (!value || isNaN(num) || num < 0 || num > 100) {
          allValid = false;
        } else {
          projections[input.dataset.candidate] = num;
        }
      });

      if (!anyFilled) {
        step2Warning.textContent =
          "Por favor, ingresa al menos un porcentaje válido antes de continuar.";
        return;
      }

      if (!allValid) {
        step2Warning.textContent =
          "Revisa que todos los campos tengan números válidos entre 0 y 100.";
        return;
      }

      const total = calculateTotal(projections);
      if (Math.abs(total - 100) > 0.5) {
        step2Warning.textContent =
          "Advertencia: el total no suma 100%. Puedes continuar, pero revísalo si quieres que sea una proyección cerrada.";
      } else {
        step2Warning.textContent = "";
      }

      fillSummaryTable();
      goToStep(3);
    });
  }

  // Paso 3
  const step3EditBtn = document.getElementById("step3-edit");
  const step3ConfirmBtn = document.getElementById("step3-confirm");

  if (step3EditBtn) {
    step3EditBtn.addEventListener("click", () => {
      restoreInputsFromProjections();
      updateTotalLabel();
      goToStep(2);
    });
  }

  if (step3ConfirmBtn) {
    step3ConfirmBtn.addEventListener("click", async () => {
      try {
        await registerCurrentParticipantResult();
        fillFinalSummaryTable();
        goToStep(4);
      } catch (err) {
        console.error(err);
        const step3Warning = document.getElementById("step3-warning");
        if (step3Warning) {
          step3Warning.textContent =
            "Ocurrió un problema al registrar tus resultados. Intenta nuevamente.";
        }
      }
    });
  }
}

function handlePercentChange(event) {
  const input = event.target;
  const candidate = input.dataset.candidate;
  const rawValue = input.value.trim();
  const num = parsePercentValue(rawValue);

  if (!isNaN(num) && num >= 0 && num <= 100) {
    projections[candidate] = num;
  } else if (rawValue === "") {
    projections[candidate] = 0;
  }
  updateTotalLabel();
}

function updateTotalLabel() {
  const totalLabel = document.getElementById("total-porcentaje");
  if (!totalLabel) return;
  const total = calculateTotal(projections);
  totalLabel.textContent = formatPercent(total);
}

function fillSummaryTable() {
  const tbody = document.getElementById("summary-body");
  const summaryTotal = document.getElementById("summary-total");
  if (!tbody || !summaryTotal) return;

  tbody.innerHTML = "";

  CANDIDATES.forEach((name) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdValue = document.createElement("td");

    tdName.textContent = name;
    const value = projections[name] || 0;
    tdValue.textContent = formatPercent(value);

    tr.appendChild(tdName);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
  });

  const total = calculateTotal(projections);
  summaryTotal.textContent = formatPercent(total);
}

function fillFinalSummaryTable() {
  const tbody = document.getElementById("final-summary-body");
  const finalTotal = document.getElementById("final-summary-total");
  if (!tbody || !finalTotal) return;

  tbody.innerHTML = "";

  CANDIDATES.forEach((name) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdValue = document.createElement("td");

    tdName.textContent = name;
    const value = projections[name] || 0;
    tdValue.textContent = formatPercent(value);

    tr.appendChild(tdName);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
  });

  const total = calculateTotal(projections);
  finalTotal.textContent = formatPercent(total);
}

function restoreInputsFromProjections() {
  const inputs = document.querySelectorAll(".percent-input");
  inputs.forEach((input) => {
    const candidate = input.dataset.candidate;
    const val = projections[candidate];
    if (typeof val === "number" && !isNaN(val)) {
      input.value = val.toFixed(1).replace(".", ",");
    }
  });
}

async function registerCurrentParticipantResult() {
  const projCopy = {};
  CANDIDATES.forEach((c) => {
    projCopy[c] = projections[c] || 0;
  });

  const body = {
    name: participantName,
    projections: projCopy
  };

  const resp = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!resp.ok) throw new Error("Error al registrar resultado");
}
