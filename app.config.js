const baseConfig = require('./app.json');

const WIDGETS_ENABLED = process.env.EXPO_ENABLE_WIDGETS === '1';

const widgetPlugin = [
  'expo-widgets',
  {
    bundleIdentifier: 'com.alioz.everydaytoolbox.widgets',
    groupIdentifier: 'group.com.alioz.everydaytoolbox',
    widgets: [
      {
        name: 'ToolboxOverviewWidget',
        displayName: 'Everyday Overview',
        description: 'See groceries, the oldest Last Time item, and the next reminder.',
        supportedFamilies: ['systemSmall', 'systemMedium', 'systemLarge'],
      },
      {
        name: 'ToolboxCountdownWidget',
        displayName: 'Countdowns',
        description: 'See your most important upcoming countdown.',
        supportedFamilies: ['systemSmall', 'systemMedium', 'accessoryRectangular'],
      },
    ],
  },
];

function withoutWidgets(plugins = []) {
  return plugins.filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== 'expo-widgets';
  });
}

module.exports = ({ config }) => {
  const expo = {
    ...config,
    ...baseConfig.expo,
    plugins: withoutWidgets(baseConfig.expo.plugins),
  };

  if (WIDGETS_ENABLED) {
    expo.plugins.push(widgetPlugin);
  }

  return expo;
};
