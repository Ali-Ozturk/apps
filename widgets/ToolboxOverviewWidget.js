import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function ToolboxOverviewWidget(props, environment) {
  'widget';

  const compact = environment.widgetFamily === 'systemSmall';

  return (
    <VStack
      alignment="leading"
      spacing={compact ? 6 : 8}
      modifiers={[containerBackground('#F5F7FB', 'widget'), padding({ all: 14 })]}
    >
      <Text modifiers={[font({ weight: 'bold', size: compact ? 13 : 15 }), foregroundStyle('#111827')]}>Everyday Toolbox</Text>
      <Spacer />
      <Text modifiers={[font({ weight: 'bold', size: compact ? 17 : 19 }), foregroundStyle('#1677FF')]}>Today</Text>
      {props.groceryTotal > 0 ? (
        <Text modifiers={[font({ size: compact ? 12 : 14 }), foregroundStyle('#344054')]}>Groceries {props.groceryDone}/{props.groceryTotal}</Text>
      ) : (
        <Text modifiers={[font({ size: compact ? 12 : 14 }), foregroundStyle('#667085')]}>No groceries yet</Text>
      )}
      {!compact && props.lastTitle ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#344054')]}>Last: {props.lastTitle} ({props.lastRelative})</Text>
      ) : null}
      {!compact && props.nextReminderTitle ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#344054')]}>Next: {props.nextReminderTitle}</Text>
      ) : null}
      {!compact && !props.nextReminderTitle ? (
        <HStack><Text modifiers={[font({ size: 13 }), foregroundStyle('#667085')]}>No upcoming reminders</Text></HStack>
      ) : null}
    </VStack>
  );
}

export default createWidget('ToolboxOverviewWidget', ToolboxOverviewWidget);
