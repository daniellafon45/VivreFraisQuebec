const fs = require('fs');
let s = fs.readFileSync('src/data/cities.ts', 'utf8');
s = s.replace(/([a-zA-Zà-üÀ-Ü])'([a-zA-Zà-üÀ-Ü])/g, "$1\\\\'$2");
fs.writeFileSync('src/data/cities.ts', s);
console.log('Fixed syntax quotes');
