const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replaceAll('#9ca3af', 'var(--text-muted)');
content = content.replaceAll('background: "rgba(30, 41, 59, 0.7)"', 'borderLeft: "4px solid var(--brand-green)"');
content = content.replaceAll('style={{ background: "#2563eb", whiteSpace: "nowrap" }}', 'style={{ whiteSpace: "nowrap" }}');
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Successfully updated color tokens in app/page.tsx');
