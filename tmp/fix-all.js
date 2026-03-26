const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;

  if (content.includes('auth.currentUser.uid')) {
      content = content.replace(/`players',\s*auth\.currentUser\.uid\)/g, "'players', auth.currentUser.uid)");
      
      // Fix console.error(`Błąd...:', e)
      content = content.replace(/console\.error\(`Błąd(.*?):', (e|error|err)\)/g, "console.error('Błąd$1:', $2)");
      content = content.replace(/console\.error\(`Błąd(.*?):", (e|error|err)\)/g, "console.error('Błąd$1:', $2)");

      // Fix `players/${auth.currentUser.uid}/...' -> check correctly 
      // This part was fine mostly.
      
      // Import auth if missing
      if (!content.includes('auth } from')) {
          content = content.replace(/import\s+\{\s*db\s*\}\s+from\s+([^;]+);?/g, "import { db, auth } from $1;");
      }
      if (!content.includes('auth } from') && !content.includes('import { auth')) {
          // fallback, usually the above should cover it if they import db
      }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned up bugs in: ${filePath}`);
  }
}

walkDir('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src', processFile);
console.log('Cleanup Done!');
