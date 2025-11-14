// server.js – Backend Node.js para la Polla Rommel con ranking público y admin

const express = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Candidatos (defínelos aquí una sola vez)
const CANDIDATES = [
  "Franco Parisi",
  "Jeannette Jara",
  "Marco Enriquez-Ominami",
  "Johannes Kaiser"
  "José Antonio Kast",
  "Eduardo Artés"
  "Evelyn Mathei",
  "Harold Mayne-Nicholls",
  "Blanco/Nulo",
];

const EXCEL_PATH = path.join(__dirname, "polla_rommel_resultados.xlsx");
const REAL_PATH = path.join(__dirname, "polla_rommel_real.json");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ---------- Utilidades internas ----------

function ensureExcelFile() {
  if (!fs.existsSync(EXCEL_PATH)) {
    const wb = XLSX.utils.book_new();
    const header = ["Participante", ...CANDIDATES];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, EXCEL_PATH);
  }
}

function loadExcel() {
  ensureExcelFile();
  return XLSX.readFile(EXCEL_PATH);
}

function saveExcel(wb) {
  XLSX.writeFile(wb, EXCEL_PATH);
}

function loadReal() {
  if (!fs.existsSync(REAL_PATH)) {
    const init = {};
    CANDIDATES.forEach((c) => (init[c] = null));
    return init;
  }
  try {
    const raw = fs.readFileSync(REAL_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const real = {};
    CANDIDATES.forEach((c) => {
      if (typeof parsed[c] === "number" && !isNaN(parsed[c])) {
        real[c] = parsed[c];
      } else {
        real[c] = null;
      }
    });
    return real;
  } catch (e) {
    const init = {};
    CANDIDATES.forEach((c) => (init[c] = null));
    return init;
  }
}

function saveReal(real) {
  fs.writeFileSync(REAL_PATH, JSON.stringify(real, null, 2), "utf8");
}

// ---------- ENDPOINTS PÚBLICOS ----------

// Lista de candidatos (para front público y admin)
app.get("/api/candidates", (req, res) => {
  res.json({ candidates: CANDIDATES });
});

// Registrar participante
app.post("/api/register", (req, res) => {
  const { name, projections } = req.body;

  if (!name || !projections) {
    return res.status(400).json({ error: "Faltan campos (name, projections)" });
  }

  const wb = loadExcel();
  const ws = wb.Sheets["Resultados"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!data.length) {
    const header = ["Participante", ...CANDIDATES];
    data.push(header);
  }

  const row = [name];
  CANDIDATES.forEach((c) => {
    const val = projections[c];
    if (typeof val === "number") {
      row.push(val);
    } else {
      const parsed = parseFloat(val);
      row.push(isNaN(parsed) ? "" : parsed);
    }
  });

  data.push(row);

  const newWS = XLSX.utils.aoa_to_sheet(data);
  wb.Sheets["Resultados"] = newWS;
  saveExcel(wb);

  res.json({ status: "OK" });
});

// Obtener resultados crudos (Excel) para ranking
app.get("/api/results", (req, res) => {
  ensureExcelFile();
  const wb = loadExcel();
  const ws = wb.Sheets["Resultados"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!data.length) {
    return res.json({ header: [], rows: [] });
  }

  const [header, ...rows] = data;
  res.json({ header, rows });
});

// ---------- ENDPOINTS ADMIN ----------

// Devolver reales actuales
app.get("/api/admin/real", (req, res) => {
  const real = loadReal();
  res.json({ real });
});

// Guardar reales enviados por admin
app.post("/api/admin/real", (req, res) => {
  const bodyReal = req.body.real || {};
  const realToSave = {};
  CANDIDATES.forEach((c) => {
    const val = bodyReal[c];
    if (typeof val === "number" && !isNaN(val)) {
      realToSave[c] = val;
    }
  });
  saveReal(realToSave);
  res.json({ status: "OK" });
});

// Ranking admin: Score = √(∑ (Pred - Real)^2)
app.get("/api/admin/ranking", (req, res) => {
  ensureExcelFile();
  const real = loadReal();

  const wb = loadExcel();
  const ws = wb.Sheets["Resultados"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!data.length || data.length === 1) {
    return res.json({ ranking: [] });
  }

  const [header, ...rows] = data;

  const rankingRaw = rows.map((row) => {
    const name = row[0] || "";
    let sumSquares = 0;
    let hasAny = false;

    CANDIDATES.forEach((c, idx) => {
      const colIndex = idx + 1;
      const predRaw = row[colIndex];
      const pred = typeof predRaw === "number" ? predRaw : parseFloat(predRaw);
      const realVal = real[c];

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

    return { name, score };
  });

  rankingRaw.sort((a, b) => {
    if (!isFinite(a.score) && !isFinite(b.score)) return 0;
    if (!isFinite(a.score)) return 1;
    if (!isFinite(b.score)) return -1;
    return a.score - b.score;
  });

  const ranking = rankingRaw.map((item, idx) => ({
    position: idx + 1,
    name: item.name,
    score: item.score,
    isLast: idx === rankingRaw.length - 1
  }));

  res.json({ ranking });
});

// Descargar Excel
app.get("/api/admin/download-excel", (req, res) => {
  ensureExcelFile();
  res.download(EXCEL_PATH);
});

// Resetear Excel + reales
app.delete("/api/admin/reset-excel", (req, res) => {
  if (fs.existsSync(EXCEL_PATH)) fs.unlinkSync(EXCEL_PATH);
  if (fs.existsSync(REAL_PATH)) fs.unlinkSync(REAL_PATH);
  ensureExcelFile();
  res.json({ status: "RESET_OK" });
});

// Páginas estáticas
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/ranking", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ranking.html"));
});

app.listen(PORT, () => {
  console.log("Servidor Polla Rommel corriendo en puerto", PORT);
});
