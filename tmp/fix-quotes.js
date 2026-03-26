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
  
  if (!content.includes('auth.currentUser.uid')) return;

  // Fix mixed quotes like: `players/${auth.currentUser.uid}/trains') => `players/${auth.currentUser.uid}/trains`)
  content = content.replace(/uid\}\/([^']+)'/g, "uid}/$1`");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed quotes in: ${filePath}`);
  }
}

walkDir('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src', processFile);
console.log('Done!');
