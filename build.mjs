// Inlines dist/bundle.js into src/shell.html -> dist/index.html (single self-contained file, works offline / iOS Safari)
import fs from 'fs';
const shell = fs.readFileSync('src/shell.html', 'utf8');
const bundle = fs.readFileSync('dist/bundle.js', 'utf8').replace(/<\/script>/g, '<\\/script>');
fs.writeFileSync('dist/index.html', shell.replace('/*BUNDLE*/', bundle));
fs.unlinkSync('dist/bundle.js');
console.log('dist/index.html', (fs.statSync('dist/index.html').size / 1024).toFixed(0), 'KB');
