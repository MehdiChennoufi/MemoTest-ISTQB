const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// Tentative de chargement de .env.local puis .env
if (fs.existsSync(".env.local")) {
  require("dotenv").config({ path: ".env.local" });
} else {
  require("dotenv").config();
}

// Configuration
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY);

async function parseSyllabus(pdfPath, outputJsonName) {
  if (!API_KEY || API_KEY === "votre_cle_api_ici") {
    console.error(
      "L'API Key Gemini est absente ou non configurée. Veuillez vérifier votre fichier .env.local",
    );
    process.exit(1);
  }

  console.log(`Préparation du fichier : ${pdfPath}...`);

  try {
    // 1. Upload du fichier vers Google AI File API
    const uploadResult = await fileManager.uploadFile(pdfPath, {
      mimeType: "application/pdf",
      displayName: outputJsonName,
    });

    const fileName = uploadResult.file.name;
    console.log(`Fichier uploadé avec succès : ${fileName}`);

    // 2. Attente que le fichier soit prêt (état ACTIVE)
    let file = await fileManager.getFile(fileName);
    while (file.state === "PROCESSING") {
      process.stdout.write(".");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      file = await fileManager.getFile(fileName);
    }

    if (file.state === "FAILED") {
      throw new Error("L'upload du fichier a échoué sur Google AI.");
    }

    console.log("\nFichier prêt. Analyse par Gemini 2.5 Flash...");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 30000,
      },
    });

    const prompt = `
      Agis en tant qu'expert en certifications ISTQB et analyste de données.
      Analyse ce syllabus PDF (ISTQB) et extrait les données structurées pour mon application "MemoTest".
      
      Instructions critiques :
      1. Génère un JSON valide respectant strictement ce schéma.
      2. Pour les chapitres, sois exhaustif sur les sections.
      3. Pour le quiz, génère exactement 3 questions de haute qualité par chapitre (pour limiter la taille de sortie et éviter les troncatures). Les questions doivent être de niveau "Examen ISTQB" (pièges, nuances).
      4. Les "keyPoints" doivent être des conseils concrets pour réussir l'examen sur cette section.
      
      Schéma JSON attendu :
      {
        "title": "Nom descriptif complet de la certification (ex: Test Automation Engineer, AI Tester, Foundation Level). Évite les acronymes seuls comme CTAL-TAE ou CTFL.",
        "shortName": "Nom court et clair (ex: GenAI, Automation, Foundation, Manager)",
        "fullName": "Code complet et officiel (ex: ISTQB® CTAL-TAE v2.0)",
        "bos": [ {"id": "ID", "text": "Objectif métier"} ],
        "chapters": [
          {
            "id": 1,
            "title": "Titre du chapitre",
            "duration": "temps estimé (ex: 60 min)",
            "icon": "nom_icone_material (ex: account_tree, psychology, construction, speed)",
            "los": "plage d'objectifs (ex: GA-1.1.1)",
            "sections": [
              {
                "num": "1.1",
                "title": "Sous-titre",
                "content": "Contenu détaillé formaté en Markdown léger. Utilise **gras** pour les termes clés.",
                "keyPoints": ["point stratégique 1", "point stratégique 2"],
                "alert": "Piège fréquent à l'examen"
              }
            ]
          }
        ],
        "quizData": [
          {
            "q": "Question type examen ?",
            "opts": ["Option A", "Option B", "Option C", "Option D"],
            "answer": 0,
            "explanation": "Explication pédagogique complète citant pourquoi les autres sont fausses.",
            "tip": "Moyen mnémotechnique"
          }
        ],
        "glossaryData": {
          "A": [ { "term": "Terme", "def": "Définition officielle" } ]
        }
      }
    `;

    // 3. Appel de l'IA avec la référence du fichier
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();

    let structuredData;
    try {
      structuredData = JSON.parse(text);
    } catch (e) {
      console.error("Erreur de parsing JSON. Voici un extrait du texte reçu :");
      console.error(text.substring(0, 500) + "...");
      console.error("... fin du texte : ...");
      console.error(text.substring(text.length - 500));
      throw e;
    }

    const outputPath = path.join(
      __dirname,
      "..",
      "data",
      `${outputJsonName}.json`,
    );
    fs.writeFileSync(outputPath, JSON.stringify(structuredData, null, 2));

    console.log(`Fichier JSON généré avec succès dans : ${outputPath}`);

    // 4. Nettoyage : suppression du fichier sur Google AI
    await fileManager.deleteFile(fileName);
    console.log("Fichier temporaire supprimé de Google AI Cloud.");
  } catch (error) {
    console.error("Erreur lors de l'analyse avec Gemini 2.5 Flash :", error);
    process.exit(1);
  }
}

// Usage: node tools/pdf-parser.js path/to/file.pdf output_name
const args = process.argv.slice(2);
if (args.length >= 1) {
  parseSyllabus(args[0], args[1] || "extracted");
} else {
  console.log(
    "Usage: node tools/pdf-parser.js <chemin_pdf> [nom_fichier_sortie]",
  );
}
