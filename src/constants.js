export const KEYS = {
  api: 'toolbox.api',
  countdown: 'toolbox.countdown',
  groceries: 'toolbox.groceries',
  last: 'toolbox.last',
};

export const EXTRA_KEYS = {
  checklist: 'toolbox.checklist',
  people: 'toolbox.people',
  receipts: 'toolbox.receipts',
  toolOrder: 'toolbox.toolOrder',
  wheel: 'toolbox.wheel',
};

export const RECEIPT_IMAGE_DIR = 'receipt-vault';

export const tools = [
  { id: 'reminders', title: 'Reminders', icon: '◷', description: 'Schedule local notifications' },
  { id: 'last', title: 'Last Time', icon: '↻', description: 'Track when you last did something' },
  { id: 'countdown', title: 'Countdowns', icon: '⌛', description: 'See time remaining to events' },
  { id: 'groceries', title: 'Grocery List', icon: '✓', description: 'Keep today\'s list and history' },
  { id: 'api', title: 'API Toolbox', icon: '{}', description: 'Run saved API actions securely' },
  { id: 'receipts', title: 'Receipt Vault', icon: '▣', description: 'Keep receipt photos findable' },
  { id: 'checklist', title: 'Daily Checklist', icon: '☑', description: 'Resettable everyday checklist' },
  { id: 'people', title: 'People Notes', icon: '◉', description: 'Remember useful things about people' },
  { id: 'wheel', title: 'Random Wheel', icon: '◌', description: 'Pick a winner fairly' },
];

export const repeatOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];
