const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'controllers');
const files = fs.readdirSync(dir);

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace { success: true, data: X } with X
  content = content.replace(/res\.status\((\d+)\)\.json\(\{\s*success:\s*true,\s*data:\s*(.*?)\s*\}\);/g, 'res.status($1).json($2);');

  // Replace { success: false, error: X } with { error: X }
  content = content.replace(/res\.status\((\d+)\)\.json\(\{\s*success:\s*false,\s*error:\s*(.*?)\s*\}\);/g, 'res.status($1).json({ error: $2 });');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed controllers');
