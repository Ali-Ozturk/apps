const fs = require('fs');
const path = require('path');

function readPackageVersion(packageName) {
  try {
    return require(path.join(process.cwd(), 'node_modules', packageName, 'package.json')).version;
  } catch {
    return null;
  }
}

function replaceOnce(filePath, before, after, label, options = {}) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (after && source.includes(after)) {
    return false;
  }

  if (!source.includes(before)) {
    if (!after || options.optional) {
      return false;
    }

    throw new Error(`${label} patch failed: expected source was not found in ${filePath}.`);
  }

  fs.writeFileSync(filePath, source.replace(before, after));
  return true;
}

function ensureIncludes(filePath, expected, label) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes(expected)) {
    throw new Error(`${label} patch failed: expected patched source was not found in ${filePath}.`);
  }
}

function replacePattern(filePath, pattern, after, label) {
  const source = fs.readFileSync(filePath, 'utf8');
  const nextSource = source.replace(pattern, after);

  if (nextSource === source) {
    return false;
  }

  fs.writeFileSync(filePath, nextSource);
  return true;
}

const expoWidgetsPath = path.join(process.cwd(), 'node_modules', 'expo-widgets');
const expoUiPath = path.join(process.cwd(), 'node_modules', '@expo', 'ui');
const autolinkingPath = path.join(
  process.cwd(),
  'node_modules',
  'expo-widgets',
  'scripts',
  'autolinking.rb'
);

const before = 'Expo::AutolinkingManager.new(self, @current_target_definition, options).resolve';
const after = 'Expo::AutolinkingManager.new(self, @current_target_definition, options).send(:resolve)';

if (!fs.existsSync(expoWidgetsPath)) {
  console.log('expo-widgets autolinking patch skipped: expo-widgets is not installed.');
  process.exit(0);
}

let changed = false;

try {
  changed = replaceOnce(autolinkingPath, before, after, 'expo-widgets autolinking') || changed;

  const expoVersion = readPackageVersion('expo');
  const expoUiVersion = readPackageVersion('@expo/ui');

  if (expoVersion?.startsWith('54.') && expoUiVersion?.startsWith('55.')) {
    const hostViewPath = path.join(expoUiPath, 'ios', 'HostView.swift');
    const rnHostViewPath = path.join(expoUiPath, 'ios', 'RNHostView.swift');
    const listViewPath = path.join(expoUiPath, 'ios', 'ListView.swift');
    const pickerViewPath = path.join(expoUiPath, 'ios', 'Picker', 'PickerView.swift');
    const baseViewPath = path.join(expoUiPath, 'ios', 'UIBaseView.swift');
    const baseViewPropsPath = path.join(expoUiPath, 'ios', 'UIBaseViewProps.swift');

    changed =
      replaceOnce(
        hostViewPath,
        'internal final class HostViewProps: ExpoSwiftUI.ViewProps, ExpoSwiftUI.SafeAreaControllable {',
        'internal final class HostViewProps: ExpoSwiftUI.ViewProps {',
        '@expo/ui HostViewProps'
      ) || changed;
    changed =
      replaceOnce(
        hostViewPath,
        '  @Field var ignoreSafeArea: ExpoSwiftUI.IgnoreSafeArea?\n',
        '',
        '@expo/ui HostView safe area'
      ) || changed;
    changed =
      replaceOnce(
        hostViewPath,
        '      props.shadowNodeProxy.setStyleSize?(styleWidth, styleHeight)\n',
        '',
        '@expo/ui HostView shadow node'
      ) || changed;
    changed =
      replaceOnce(
        rnHostViewPath,
        '    props.children?.first?.uiView',
        '    nil',
        '@expo/ui RNHostView child lookup'
      ) || changed;
    changed =
      replaceOnce(
        rnHostViewPath,
        '        .modifier(ReportSizeToYogaNodeModifier(shadowNodeProxy: props.shadowNodeProxy))',
        '        .modifier(ReportSizeToYogaNodeModifier(shadowNodeProxy: ExpoSwiftUI.ShadowNodeProxy()))',
        '@expo/ui RNHostView shadow node'
      ) || changed;
    changed =
      replaceOnce(
        baseViewPropsPath,
        '  public required init(rawProps: [String: Any], context: AppContext) throws {\n    try super.init(rawProps: rawProps, context: context)\n  }',
        '  public required init(rawProps: [String: Any], context: AppContext) throws {\n    super.init()\n    try update(withDict: rawProps, appContext: context)\n  }',
        '@expo/ui ViewProps initializer',
        { optional: true }
      ) || changed;
    changed =
      replaceOnce(
        baseViewPropsPath,
        '  public required init(rawProps: [String: Any], context: AppContext) throws {\n    try super.init(from: rawProps, appContext: context)\n  }',
        '  public required init(rawProps: [String: Any], context: AppContext) throws {\n    super.init()\n    try update(withDict: rawProps, appContext: context)\n  }',
        '@expo/ui ViewProps initializer',
        { optional: true }
      ) || changed;
    ensureIncludes(
      baseViewPropsPath,
      '  public required init(rawProps: [String: Any], context: AppContext) throws {\n    super.init()\n    try update(withDict: rawProps, appContext: context)\n  }',
      '@expo/ui ViewProps initializer'
    );
    changed =
      replacePattern(
        baseViewPath,
        /\r?\n\/\/ MARK: - ViewWrapper\r?\n\r?\nextension UIBaseView: ExpoSwiftUI\.ViewWrapper \{\r?\n  public func getWrappedView\(\) -> Any \{\r?\n    return innerView\r?\n  \}\r?\n\}\r?\n/,
        '\n',
        '@expo/ui ViewWrapper'
      ) || changed;
    changed =
      replacePattern(
        baseViewPath,
        /  return ExpoSwiftUI\.ViewDefinition\(wrappedType, name: contentName, elements: elements\(\)\)/,
        '  return View(wrappedType) {\n    ViewName(contentName)\n  }',
        '@expo/ui ViewDefinition overload'
      ) || changed;
    ensureIncludes(
      baseViewPath,
      '  return View(wrappedType) {\n    ViewName(contentName)\n  }',
      '@expo/ui ViewDefinition overload'
    );
    changed =
      replaceOnce(
        listViewPath,
        '    .onChange(of: props.selection) { newValue in\n      selection = Self.getHashableSetFromEither(newValue)\n    }\n',
        '',
        '@expo/ui ListView selection observer'
      ) || changed;
    changed =
      replaceOnce(
        pickerViewPath,
        '    .onChange(of: props.selection) { newValue in\n      selection = Self.getHashableFromEither(newValue)\n    }\n',
        '',
        '@expo/ui PickerView selection observer'
      ) || changed;
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(changed ? 'expo widgets compatibility patches applied.' : 'expo widgets compatibility patches already applied.');
