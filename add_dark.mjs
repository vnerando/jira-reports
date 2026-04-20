import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.join(process.cwd(), 'portal', 'src', 'pages', 'AnalyticView.jsx');
let content = fs.readFileSync(TARGET_FILE, 'utf-8');

// 1. Signature
content = content.replace(
  'const AnalyticView = ({ months = [], onGenerateSuccess }) => {',
  'const AnalyticView = ({ months = [], onGenerateSuccess, isDark }) => {'
);

// 2. Chart configurations
content = content.replace(
  /color: '#e5e7eb'/g,
  "color: isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb'"
);
content = content.replace(
  /color: '#374151'/g,
  "color: isDark ? '#cbd5e1' : '#374151'"
);

// 3. Tailwind Classes
const replacements = {
  'bg-white ': 'bg-white dark:bg-slate-800 transition-colors duration-200 ',
  'bg-white"': 'bg-white dark:bg-slate-800 transition-colors duration-200"',
  'border-gray-100': 'border-gray-100 dark:border-slate-700',
  'border-gray-200': 'border-gray-200 dark:border-slate-700',
  'text-gray-800': 'text-gray-800 dark:text-gray-100',
  'text-gray-700': 'text-gray-700 dark:text-gray-200',
  'text-gray-600': 'text-gray-600 dark:text-gray-300',
  'text-gray-500': 'text-gray-500 dark:text-gray-400',
  'text-gray-400': 'text-gray-400 dark:text-gray-500',
  'bg-gray-50 ': 'bg-gray-50 dark:bg-slate-800 ',
  'bg-gray-50"': 'bg-gray-50 dark:bg-slate-800"',
  'bg-gray-100': 'bg-gray-100 dark:bg-slate-700',
  'divide-gray-100': 'divide-gray-100 dark:divide-slate-700',
  'bg-indigo-50 ': 'bg-indigo-50 dark:bg-indigo-900/40 ',
  'bg-indigo-50"': 'bg-indigo-50 dark:bg-indigo-900/40"',
  'bg-green-50': 'bg-green-50 dark:bg-emerald-900/30',
  'bg-red-50': 'bg-red-50 dark:bg-red-900/30',
  'bg-emerald-50': 'bg-emerald-50 dark:bg-emerald-900/30'
};

for (const [find, replace] of Object.entries(replacements)) {
  // Use global regex
  const regex = new RegExp(find, 'g');
  content = content.replace(regex, replace);
}

fs.writeFileSync(TARGET_FILE, content);
console.log('AnalyticView.jsx updated with Dark Mode support.');
