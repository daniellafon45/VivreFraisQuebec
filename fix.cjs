const fs = require('fs');
let s = fs.readFileSync('src/data/cities.ts', 'utf8');

// Undo any previous mess and correctly escape
s = s.replace(/([a-zA-Zà-üÀ-Ü])(?:'|\\\\'|\\'|\\\\\\')([a-zA-Zà-üÀ-Ü])/g, (match, p1, p2) => {
    return p1 + "\\'" + p2;
});

fs.writeFileSync('src/data/cities.ts', s);
console.log('Fixed quotes with callback');
