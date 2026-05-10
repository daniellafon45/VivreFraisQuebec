const fs = require('fs');
const lines = fs.readFileSync('src/data/cities.ts', 'utf8').split('\n');
const names = [];
lines.forEach((l, i) => {
  const match = l.match(/name:\s*['"]([^'"]+)['"]/);
  if (match) names.push(match[1]);
});
console.log(JSON.stringify(names));
