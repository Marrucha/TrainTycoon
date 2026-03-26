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
  
  if (!content.includes('player1')) return;

  // Replace 'players/player1/...' with `players/${uid}/...`
  // We will import auth and get uid inside the file.
  
  // Replace string literals starting with 'players/player1
  content = content.replace(/'players\/player1\//g, "`players/${auth.currentUser.uid}/");
  // Replace string literals like 'players', 'player1'
  content = content.replace(/'players',\s*'player1'/g, "'players', auth.currentUser.uid");
  // Replace template literals
  content = content.replace(/players\/player1\//g, "players/${auth.currentUser.uid}/");
  // For ReportsMenu / PolicySection etc
  content = content.replace(/brandings\/player1\//g, "brandings/${auth.currentUser.uid}/");

  if (content !== original) {
    // Inject import if not exists
    if (!content.includes("from '../../firebase/config'") && !content.includes("from '../firebase/config'") && filePath.includes('hooks')) {
      content = `import { auth } from '../../firebase/config';\n` + content;
    } else if (filePath.includes('GameContext.jsx') && !content.includes('auth')) {
        content = content.replace("import { db } from '../firebase/config'", "import { db, auth } from '../firebase/config'");
    } else if (filePath.includes('components') && !content.includes('auth')) {
        const depth = filePath.split('src')[1].split(path.sep).length - 2;
        const relativePrefix = '../'.repeat(depth) || './';
        content = `import { auth } from '${relativePrefix}firebase/config';\n` + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

walkDir('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src', processFile);
console.log('Done!');
