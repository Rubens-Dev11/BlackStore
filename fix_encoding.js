const fs = require('fs');
try { fs.writeFileSync('admin_clean.txt', fs.readFileSync('admin_err.txt', 'utf16le'), 'utf8'); } catch(e){}
try { fs.writeFileSync('api_clean.txt', fs.readFileSync('api_err.txt', 'utf16le'), 'utf8'); } catch(e){}
console.log('done');
