// Prints the Linear issue description (Markdown) for one bug from reports/Linear/plan.json.
//   node scripts/reports/linear-desc.js BUG-01 "<image markdown or empty>"
const plan = require('../../reports/Linear/plan.json');
const [id, image = ''] = process.argv.slice(2);
const b = plan.find(p => p.id === id);
if (!b) { console.error('unknown bug ' + id); process.exit(1); }
const lines = [
  '### **Description:**', '',
  `**Module:** ${b.module}  |  **Screen:** ${b.screen}  |  **Type:** ${b.type}  |  **Severity:** ${b.severity}`, '',
  '### **Steps to reproduce:**', '', b.steps, '',
  '### **Actual Result:**', '', b.actual, '',
  '### **Expected Result:**', '', b.expected, '',
  `**Environment:** STAGE https://erp.nexgenpilot.com (company "sb", app v1.0.2, Chrome)  |  **Automated test:** ${b.tc}  |  **Bug report ID:** ${b.id}`,
];
if (image) lines.push('', image);
process.stdout.write(lines.join('\n'));
