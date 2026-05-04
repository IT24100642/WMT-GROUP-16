const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'models');
const files = fs.readdirSync(dir);

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip required: true
  content = content.replace(/required:\s*true\s*,?/g, '');
  
  // Strip enum arrays
  content = content.replace(/enum:\s*\[.*?\],?/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Stripped Mongoose validations');
