const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const inputPath = path.join(rootDir, 'public', 'logo.png');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(inputPath)) {
  console.error("❌ ERREUR : Le fichier public/logo.png est introuvable.");
  console.error("Veuillez sauvegarder votre logo sous le nom 'logo.png' dans le dossier 'public' avant de lancer ce script.");
  process.exit(1);
}

async function generateIcons() {
  try {
    console.log("Génération des icônes PWA en cours...");

    // 192x192
    await sharp(inputPath)
      .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log("✅ icon-192x192.png généré.");

    // 512x512
    await sharp(inputPath)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log("✅ icon-512x512.png généré.");

    // apple-touch-icon (180x180 with solid background for iOS)
    await sharp(inputPath)
      .resize(180, 180, { fit: 'contain', background: { r: 247, g: 248, b: 245, alpha: 1 } }) // #f7f8f5
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log("✅ apple-touch-icon.png généré.");

    // favicon (32x32)
    await sharp(inputPath)
      .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, 'favicon.ico'));
    console.log("✅ favicon.ico généré.");

    console.log("🎉 Toutes les icônes PWA ont été générées avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors de la génération :", error);
  }
}

generateIcons();
