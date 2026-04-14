const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { exec } = require("child_process");
require("dotenv").config();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Sert les fichiers statiques de la racine

// Configuration Multer pour l'upload PDF
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// API: Récupérer le registre des certifications
app.get("/api/registry", (req, res) => {
  const registryPath = path.join(__dirname, "data", "registry.json");
  if (fs.existsSync(registryPath)) {
    const data = fs.readFileSync(registryPath, "utf8");
    res.json(JSON.parse(data));
  } else {
    res.json([]);
  }
});

// API: Upload et Parsing PDF
app.post("/api/upload", upload.single("syllabus"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("Aucun fichier téléchargé.");
  }

  const pdfPath = req.file.path;
  const originalName = req.file.originalname
    .replace(".pdf", "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  // Génération d'un slug propre : ex istqb_ctal-tae_syllabus_v2.0 -> ctal-tae
  let slug = originalName;
  if (slug.includes("istqb_")) slug = slug.split("istqb_")[1];
  if (slug.includes("_syllabus")) slug = slug.split("_syllabus")[0];
  // Nettoyage des versions et suffixes (v2.0, -fr, -final, etc.)
  slug = slug
    .replace(/_v\d+\.\d+.*$/, "")
    .replace(/-fr.*$/, "")
    .replace(/-final.*$/, "");

  const outputName = slug || originalName;

  console.log(
    `Démarrage du parsing pour : ${pdfPath} avec le slug : ${outputName}`,
  );

  // On lance le script de parsing
  exec(
    `node tools/pdf-parser.js "${pdfPath}" "${outputName}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur exec: ${error}`);
        console.error(`Stderr: ${stderr}`);
        return res
          .status(500)
          .json({ error: "Erreur lors du traitement du PDF par l'IA." });
      }

      // Vérifier si le fichier a bien été généré
      const outputPath = path.join(__dirname, "data", `${outputName}.json`);
      if (!fs.existsSync(outputPath)) {
        console.error(`Le fichier JSON n'a pas été généré : ${outputPath}`);
        return res
          .status(500)
          .json({ error: "Le parsing a échoué à générer les données." });
      }

      // Lire le contenu du fichier généré pour récupérer le vrai titre
      let certData = {};
      try {
        certData = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      } catch (e) {
        console.error("Erreur lors de la lecture du JSON généré", e);
      }

      // Une fois le parsing fini, on met à jour le registre
      const registryPath = path.join(__dirname, "data", "registry.json");
      let registry = [];
      if (fs.existsSync(registryPath)) {
        registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      }

      // Vérifier si la certif existe déjà, sinon l'ajouter ou mettre à jour
      const existsIdx = registry.findIndex((c) => c.id === outputName);
      const certEntry = {
        id: outputName,
        title: certData.title || outputName.toUpperCase().replace(/-/g, " "),
        icon:
          certData.chapters && certData.chapters[0]
            ? certData.chapters[0].icon || "menu_book"
            : "menu_book",
        description: certData.fullName || "Nouvelle certification importée.",
        path: `data/${outputName}.json`,
      };

      if (existsIdx > -1) {
        registry[existsIdx] = certEntry;
      } else {
        registry.push(certEntry);
      }

      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      // Nettoyage : suppression du PDF original après import réussi
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn("Erreur suppression PDF temporaire:", e.message);
      }

      res.json({
        success: true,
        id: outputName,
        message: `Syllabus "${certEntry.title}" importé avec succès !`,
      });
    },
  );
});

app.listen(port, () => {
  console.log(`Serveur MemoTest démarré sur http://localhost:${port}`);
});
