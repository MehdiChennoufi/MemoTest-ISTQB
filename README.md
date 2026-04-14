# 🚀 MEMOTEST MANAGER v2

## 📚 Plateforme de révision Dynamique pour Certifications ISTQB

**MemoTest** est une application interactive conçue pour aider les professionnels du test logiciel à réviser et réussir leurs certifications **ISTQB®**.

Ce projet est une évolution majeure du fork original de [Daphné Hervé](https://github.com/Daphne-Herve/MemoTestManager). Initialement conçu comme un site statique HTML/CSS, cette version v2 transforme l'expérience en une plateforme dynamique et auto-apprenante.

---

## ✨ Nouveautés de la Version Dynamique

- **🧠 Import Intelligent (IA)** : Téléchargez n'importe quel syllabus ISTQB au format PDF. L'intelligence artificielle (**Gemini 2.5 Flash**) analyse le document pour extraire automatiquement les chapitres, les objectifs métier et générer des questions de quiz pertinentes.
- **📁 Gestion multi-syllabus** : Basculez instantanément entre différentes certifications (Foundation, Test Manager, GenAI, etc.) depuis le nouveau tableau de bord.
- **⚡ Serveur Express** : Un backend léger gère désormais le registre des certifications et l'upload des nouveaux documents.
- **📱 Interface Modernisée** : Layout repensé avec Glassmorphism, micro-animations et une navigation améliorée.

---

## 🚀 Installation Rapide

1. **Cloner le projet** :

   ```bash
   git clone https://github.com/MehdiChennoufi/MemoTest-ISTQB.git
   cd MemoTest-ISTQB
   ```

2. **Installer les dépendances** :

   ```bash
   npm install
   ```

3. **Configuration de l'IA** :
   Créez un fichier `.env` à la racine et ajoutez votre clé API Google Gemini :

   ```env
   GEMINI_API_KEY=votre_cle_ici
   ```

4. **Lancer l'application** :
   ```bash
   npm start
   ```
   Rendez-vous sur `http://localhost:3001`

---

## 🛠️ Architecture

- **Frontend** : Vanilla JS / HTML5 / CSS3 (Variables CSS, Grid, Flexbox).
- **Backend** : Node.js / Express.
- **Moteur IA** : Google Generative AI (Gemini 2.5) pour le parsing de documents.
- **Données** : JSON pour la persistance locale du registre et des syllabus.

---

## 📜 Licence et Attribution

Ce projet est sous licence **CC BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike).

### 🤝 Crédits

- **Concept & Design Original** : [Daphné Hervé](https://github.com/Daphne-Herve/MemoTestManager) — Merci à elle pour la base de ce projet.
- **Évolutions Dynamiques & IA** : Mehdi Chennoufi.

---

_Usage éducatif uniquement - Toute commercialisation est interdite selon les termes de la licence originale._
