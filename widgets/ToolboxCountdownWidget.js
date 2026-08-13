import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function ToolboxCountdownWidget(props, environment) {
  'widget';

  const compact = environment.widgetFamily === 'systemSmall';

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[containerBackground('#102A43', 'widget'), padding({ all: 14 })]}
    >
      <Text modifiers={[font({ weight: 'bold', size: compact ? 13 : 15 }), foregroundStyle('#D9EAF7')]}>Countdown</Text>
      <Spacer />
      <Text modifiers={[font({ weight: 'bold', size: compact ? 18 : 21 }), foregroundStyle('#FFFFFF')]}> {props.title || 'No countdowns'}</Text>
      <Text modifiers={[font({ weight: 'bold', size: compact ? 22 : 28 }), foregroundStyle('#7DD3FC')]}> {props.remaining || 'Add an event'}</Text>
      {!compact && props.target ? <Text modifiers={[font({ size: 13 }), foregroundStyle('#D9EAF7')]}> {props.target}</Text> : null}
    </VStack>
  );
}

export default createWidget('ToolboxCountdownWidget', ToolboxCountdownWidget);
