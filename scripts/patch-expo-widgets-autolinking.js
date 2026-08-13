const fs = require('fs');
const path = require('path');

const autolinkingPath = path.join(
  process.cwd(),
  'node_modules',
  'expo-widgets',
  'scripts',
  'autolinking.rb'
);

const before = 'Expo::AutolinkingManager.new(self, @current_target_definition, options).resolve';
const after = 'Expo::AutolinkingManager.new(self, @current_target_definition, options).send(:resolve)';

if (!fs.existsSync(autolinkingPath)) {
  console.log('expo-widgets autolinking patch skipped: expo-widgets is not installed.');
  process.exit(0);
}

const source = fs.readFileSync(autolinkingPath, 'utf8');

if (source.includes(after)) {
  console.log('expo-widgets autolinking patch already applied.');
  process.exit(0);
}

if (!source.includes(before)) {
  console.error('expo-widgets autolinking patch failed: expected call site was not found.');
  process.exit(1);
}

fs.writeFileSync(autolinkingPath, source.replace(before, after));
console.log('expo-widgets autolinking patch applied.');
