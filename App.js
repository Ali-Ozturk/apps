import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView as NativeScrollView, StyleSheet, Switch, Text, TextInput, TouchableWithoutFeedback, useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { SymbolView } from 'expo-symbols';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath, Text as SvgText } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, ShadowDecorator } from 'react-native-draggable-flatlist';
import { EXTRA_KEYS, KEYS, repeatOptions, tools } from './src/constants';
import { useStored } from './src/hooks/useStored';
import { copyReceiptImage, normalizeReceiptImages, saveReceiptImageToPhotoLibrary } from './src/utils/receipts';
import { countdown, dateTime, defaultDate, id, mergeDateAndTime, relative, time, today, cap } from './src/utils/date';
import { ensureToday, groceryNames } from './src/utils/lists';
import { describeRequest, syncWidgets } from './src/widgets/syncWidgets';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

const ToastContext = createContext(() => {});

export default function App() {
  const [screen, setScreen] = useState('home');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const scheme = useColorScheme();
  useEffect(() => { syncWidgets(); }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);
  const showToast = (message) => {
    if (!message) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    softHaptic();
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  const open = (next) => setScreen(next);
  const homeIsDark = screen === 'home' && scheme === 'dark';
  return <GestureHandlerRootView style={[styles.safe, homeIsDark && homeStyles.safeDark]}><SafeAreaProvider><ToastContext.Provider value={showToast}><SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, homeIsDark && homeStyles.safeDark]}><StatusBar style={homeIsDark ? 'light' : 'dark'} />{screen === 'home' ? <DashboardStatic onOpen={open} /> : <View style={styles.flex}>{tools.map((tool) => <View key={tool.id} style={screen === tool.id ? styles.screenVisible : styles.screenHidden}><ToolFrameStatic title={tool.title} onBack={() => setScreen('home')}><Tool screen={tool.id} /></ToolFrameStatic></View>)}</View>}{toast ? <ToastBanner message={toast} /> : null}</SafeAreaView></ToastContext.Provider></SafeAreaProvider></GestureHandlerRootView>;
}

function useToast() { return useContext(ToastContext); }

function ScrollView(props) { return <NativeScrollView keyboardShouldPersistTaps="handled" {...props} />; }
function Tool({ screen }) { if (screen === 'reminders') return <ReminderTool />; if (screen === 'last') return <LastTimeTool />; if (screen === 'countdown') return <CountdownTool />; if (screen === 'groceries') return <GroceryTool />; if (screen === 'api') return <ApiTool />; if (screen === 'receipts') return <ReceiptVaultStable />; if (screen === 'checklist') return <DailyChecklistToolV2 />; if (screen === 'people') return <PeopleNotesToolV2 />; return <RandomWheelToolV2 />; }

function ReceiptVaultStable() {
  const showToast = useToast();
  const [receipts, setReceipts] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(EXTRA_KEYS.receipts)
      .then((raw) => {
        if (!active) return;
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          setReceipts(Array.isArray(parsed) ? parsed : []);
        } catch {
          setReceipts([]);
        }
      })
      .catch(() => active && setReceipts([]));
    return () => { active = false; };
  }, []);

  async function persist(next) {
    setReceipts(next);
    try {
      await AsyncStorage.setItem(EXTRA_KEYS.receipts, JSON.stringify(next));
    } catch {
      Alert.alert('Save failed', 'The receipt could not be saved on this device.');
      throw new Error('Receipt save failed');
    }
  }

  async function addImages(useCamera) {
    const permission = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission needed', `Allow ${useCamera ? 'camera' : 'photo library'} access in iOS Settings.`);
    let mediaPermission = null;
    if (useCamera) {
      mediaPermission = await MediaLibrary.requestPermissionsAsync(true);
      if (!mediaPermission.granted) return Alert.alert('Permission needed', 'Allow photo library access so camera receipts can be saved to Photos.');
    }
    const result = useCamera ? await ImagePicker.launchCameraAsync({ quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (result.canceled) return;
    try {
      const images = [];
      for (const asset of result.assets) {
        const copied = await copyReceiptImage(asset);
        if (useCamera) {
          const savedAsset = await saveReceiptImageToPhotoLibrary(asset.uri);
          copied.photoLibraryAssetId = savedAsset.id;
        }
        images.push(copied);
      }
      setEditing((current) => ({ ...(current || { images: [] }), images: [...normalizeReceiptImages(current?.images), ...images] }));
      showToast(useCamera ? 'Receipt saved to Photos and attached' : `${images.length} receipt image${images.length === 1 ? '' : 's'} attached`);
    } catch {
      Alert.alert('Image save failed', 'The receipt image could not be copied into local app storage.');
    }
  }

  async function save() {
    if (!title.trim()) return Alert.alert('Title required', 'Give this receipt a name.');
    if (!receipts) return Alert.alert('Please wait', 'Receipt storage is still loading.');
    const isEditingExistingReceipt = Boolean(editing?.id);
    const value = { id: editing?.id || id(), title: title.trim(), notes: notes.trim(), date: date.toISOString(), images: normalizeReceiptImages(editing?.images) };
    const next = isEditingExistingReceipt ? receipts.map((item) => item.id === editing.id ? value : item) : [value, ...receipts];
    try {
      await persist(next);
      clearForm();
      showToast('Receipt saved');
    } catch {}
  }

  function clearForm() { setTitle(''); setNotes(''); setDate(new Date()); setEditing(null); }
  const isEditingReceipt = Boolean(editing?.id);
  const visible = (receipts || []).filter((item) => `${item.title || ''} ${item.notes || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => new Date(b.date) - new Date(a.date));

  return <ScrollView contentContainerStyle={styles.content}>
    <Panel>
      <Text style={styles.label}>{isEditingReceipt ? 'Edit receipt' : 'New receipt'}</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Title, e.g. Grocery shop" placeholderTextColor="#98A2B3" />
      <TextInput value={notes} onChangeText={setNotes} style={styles.inputTall} placeholder="Notes (optional)" placeholderTextColor="#98A2B3" />
      <DateTimePicker mode="date" value={date} onChange={(_, value) => value && setDate(value)} />
      <View style={styles.actions}><Button small secondary text="Photo library" onPress={() => addImages(false)} /><Button small secondary text="Camera" onPress={() => addImages(true)} /></View>
      {editing?.images?.length ? <Text style={styles.muted}>{editing.images.length} image(s) attached</Text> : null}
      <Button text={isEditingReceipt ? 'Save changes' : 'Save receipt'} onPress={save} />
      {editing ? <Button secondary text="Cancel" onPress={clearForm} /> : null}
    </Panel>
    <TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Search receipts" placeholderTextColor="#98A2B3" />
    {receipts === null ? <Empty text="Loading receipts..." /> : visible.length === 0 ? <Empty text="No receipts saved yet." /> : visible.map((receipt) => {
      const receiptImages = normalizeReceiptImages(receipt.images);
      const imageUri = receiptImages[0]?.uri;
      const imageCount = receiptImages.length;
      return <View key={receipt.id} style={styles.card}>
        <View style={styles.inline}>
          <View style={styles.flex}><Text style={styles.cardTitle}>{receipt.title}</Text><Text style={styles.muted}>{dateTime(new Date(receipt.date))} · {imageCount} photo{imageCount === 1 ? '' : 's'}</Text><Text style={styles.muted}>{receipt.notes || 'No notes'}</Text></View>
          {imageUri ? <Pressable onPress={() => setViewer(imageUri)} style={homeStyles.receiptPreview}><Image source={{ uri: imageUri }} style={styles.thumbnail} />{imageCount > 1 ? <View style={homeStyles.receiptCountBadge}><Text style={homeStyles.receiptCountText}>+{imageCount - 1}</Text></View> : null}</Pressable> : null}
        </View>
        {imageCount > 1 ? <NativeScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.receiptStrip}>{receiptImages.map((image, index) => <Pressable key={`${image.uri}-${index}`} onPress={() => setViewer(image.uri)} style={homeStyles.receiptThumbButton}><Image source={{ uri: image.uri }} style={homeStyles.receiptThumb} /><Text style={homeStyles.receiptThumbLabel}>{index + 1}</Text></Pressable>)}</NativeScrollView> : null}
        <View style={styles.actions}><Button small secondary text="Edit" onPress={() => { setEditing({ ...receipt, images: normalizeReceiptImages(receipt.images) }); setTitle(receipt.title); setNotes(receipt.notes || ''); setDate(new Date(receipt.date)); }} /><Button small danger text="Delete" onPress={() => persist(receipts.filter((item) => item.id !== receipt.id)).catch(() => {})} toast="Receipt deleted" /></View>
      </View>;
    })}
    <Text style={styles.note}>Receipt details and copied images are stored locally in this app on this device.</Text>
    <Modal visible={Boolean(viewer)} transparent animationType="fade" onRequestClose={() => setViewer(null)}><Pressable style={styles.imageViewer} onPress={() => setViewer(null)}><Image source={{ uri: viewer }} resizeMode="contain" style={styles.fullImage} /></Pressable></Modal>
  </ScrollView>;
}

function DailyChecklistToolV2() {
  const [data, setData] = useStored(EXTRA_KEYS.checklist, { date: today(), items: [] }); const active = data.date === today() ? data : { date: today(), items: data.items.map((item) => ({ ...item, done: false })) }; const [name, setName] = useState(''); const [editing, setEditing] = useState(null); useEffect(() => { if (active !== data) setData(active); }, [data.date]); const update = (items) => setData({ ...active, items }); const save = () => { if (!name.trim()) return; const item = { id: editing?.id || id(), name: name.trim(), done: editing?.done || false }; update(editing ? active.items.map((x) => x.id === editing.id ? item : x) : [...active.items, item]); setName(''); setEditing(null); }; const completed = active.items.filter((item) => item.done).length;
  return <View style={styles.flex}><View style={styles.content}><Text style={styles.sectionTitle}>Today</Text><Text style={styles.muted}>{completed} / {active.items.length} completed</Text><Panel><TextInput value={name} onChangeText={setName} style={styles.input} placeholder={editing ? 'Edit checklist item' : 'Add checklist item'} placeholderTextColor="#98A2B3" /><Button text={editing ? 'Save changes' : 'Add item'} onPress={save} />{editing && <Button secondary text="Cancel" onPress={() => { setEditing(null); setName(''); }} />}</Panel></View><DraggableFlatList data={active.items} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} activationDistance={8} renderItem={({ item, drag, isActive }) => <Pressable onLongPress={drag} delayLongPress={450} style={[styles.groceryRow, isActive && styles.draggingRow]}><Pressable onPress={() => update(active.items.map((x) => x.id === item.id ? { ...x, done: !x.done } : x))} style={[styles.checkbox, item.done && styles.checkboxDone]}><Text>{item.done ? '✓' : ''}</Text></Pressable><Text style={[styles.groceryName, item.done && styles.done]}>{item.name}</Text><Pressable onPress={() => { setEditing(item); setName(item.name); }}><Text style={styles.link}>Edit</Text></Pressable><Pressable onPress={() => update(active.items.filter((x) => x.id !== item.id))}><Text style={styles.deleteText}>×</Text></Pressable></Pressable>} onDragEnd={({ data: next }) => update(next)} /></View>;
}

function PeopleNotesToolV2() {
  const [people, setPeople] = useStored(EXTRA_KEYS.people, []); const [query, setQuery] = useState(''); const [name, setName] = useState(''); const [selected, setSelected] = useState(null); const [note, setNote] = useState(''); const [editingNote, setEditingNote] = useState(null); const savePerson = () => { if (!name.trim()) return; const value = { id: selected?.id || id(), name: name.trim(), notes: selected?.notes || [] }; setPeople((current) => selected ? current.map((x) => x.id === selected.id ? value : x) : [...current, value]); setName(''); setSelected(value); }; const startNew = () => { setSelected(null); setName(''); setNote(''); setEditingNote(null); }; const saveNote = () => { if (!note.trim() || !selected) return; const value = { id: editingNote?.id || id(), text: note.trim(), createdAt: editingNote?.createdAt || new Date().toISOString() }; const nextNotes = editingNote ? selected.notes.map((x) => x.id === editingNote.id ? value : x) : [value, ...selected.notes]; const nextPerson = { ...selected, notes: nextNotes }; setPeople((current) => current.map((person) => person.id === selected.id ? nextPerson : person)); setSelected(nextPerson); setNote(''); setEditingNote(null); }; const visible = people.filter((person) => `${person.name} ${person.notes.map((x) => x.text).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.inline}><Text style={styles.sectionTitle}>People</Text><Button small secondary text="New person" onPress={startNew} /></View><TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Search people and notes" placeholderTextColor="#98A2B3" /><Panel><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Person name" placeholderTextColor="#98A2B3" /><Button text={selected ? 'Save person' : 'Add person'} onPress={savePerson} /></Panel>{visible.map((person) => <Pressable key={person.id} onPress={() => { setSelected(person); setName(person.name); }} style={[styles.card, selected?.id === person.id && styles.choiceSelected]}><Text style={styles.cardTitle}>{person.name}</Text><Text style={styles.muted}>{person.notes.length} note(s)</Text></Pressable>)}{selected && <Panel><View style={styles.inline}><Text style={styles.sectionTitle}>{selected.name}</Text><Button small danger text="Delete" onPress={() => { setPeople((x) => x.filter((person) => person.id !== selected.id)); startNew(); }} /></View><TextInput multiline value={note} onChangeText={setNote} style={styles.inputTall} placeholder="Add a quick note" placeholderTextColor="#98A2B3" /><Button text={editingNote ? 'Save note' : 'Add note'} onPress={saveNote} />{selected.notes.map((item) => <View key={item.id} style={styles.noteRow}><Text style={styles.flex}>{item.text}{`\n`}<Text style={styles.muted}>{dateTime(new Date(item.createdAt))}</Text></Text><Button small secondary text="Edit" onPress={() => { setEditingNote(item); setNote(item.text); }} /><Button small danger text="Delete" onPress={() => { const next = selected.notes.filter((x) => x.id !== item.id); const nextPerson = { ...selected, notes: next }; setSelected(nextPerson); setPeople((x) => x.map((person) => person.id === selected.id ? nextPerson : person)); }} /></View>)}</Panel>}</ScrollView>;
}

function ReminderTool() {
  const [message, setMessage] = useState(''); const [at, setAt] = useState(defaultDate()); const [recurring, setRecurring] = useState(false); const [repeat, setRepeat] = useState('daily'); const [style, setStyle] = useState('normal'); const [permission, setPermission] = useState('checking'); const [items, setItems] = useState([]);
  useEffect(() => { Notifications.getPermissionsAsync().then((p) => setPermission(p.status)); refresh(); }, []);
  async function refresh() { const list = await Notifications.getAllScheduledNotificationsAsync(); setItems(list.sort((a, b) => describeRequest(a).localeCompare(describeRequest(b)))); }
  async function allow() { const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true, allowDisplayInCarPlay: true } }); setPermission(p.status); return p.status === 'granted'; }
  async function schedule() { const text = message.trim(); if (!text) return Alert.alert('Message required', 'Enter a message.'); if (!recurring && at <= new Date()) return Alert.alert('Choose a future time', 'One-time reminders must be in the future.'); if (permission !== 'granted' && !(await allow())) return Alert.alert('Notifications disabled', 'Allow notifications in iOS Settings.'); await Notifications.scheduleNotificationAsync({ content: { title: style === 'alarm' ? 'Alarm Reminder' : 'Reminder', body: text, sound: true, interruptionLevel: style === 'alarm' ? 'timeSensitive' : 'active', data: { style, repeat, at: at.toISOString() } }, trigger: triggerFor(at, recurring, repeat) }); await refresh(); syncWidgets(); Alert.alert('Scheduled', recurring ? `${cap(repeat)} at ${time(at)}` : dateTime(at)); }
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.sectionLabel}>Notification access</Text><View style={styles.inline}><Text style={styles.muted}>{permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Denied in Settings' : 'Not requested'}</Text><Button small text="Allow" onPress={allow} /></View><Panel><Text style={styles.label}>Message</Text><TextInput multiline value={message} onChangeText={setMessage} style={styles.inputTall} placeholder="Notification message" placeholderTextColor="#98A2B3" /><Text style={styles.label}>Notice style</Text><View style={styles.row}>{['normal', 'alarm'].map((value) => <Choice key={value} selected={style === value} title={value === 'alarm' ? 'Alarm-like' : 'Normal'} onPress={() => setStyle(value)} />)}</View><Text style={styles.label}>Date</Text><DateTimePicker display="inline" mode="date" value={at} onChange={(_, d) => d && setAt(mergeDateAndTime(d, at))} /><Text style={styles.label}>Time</Text><DateTimePicker display="spinner" mode="time" value={at} onChange={(_, d) => d && setAt(mergeDateAndTime(at, d))} /><View style={styles.inline}><View><Text style={styles.label}>Recurring</Text><Text style={styles.muted}>{recurring ? `${cap(repeat)} at ${time(at)}` : `One time on ${dateTime(at)}`}</Text></View><Switch value={recurring} onValueChange={setRecurring} /></View>{recurring && <View style={styles.segment}>{repeatOptions.map((o) => <Pressable key={o.value} onPress={() => setRepeat(o.value)} style={[styles.segmentItem, repeat === o.value && styles.segmentSelected]}><Text style={repeat === o.value ? styles.segmentTextSelected : styles.segmentText}>{o.label}</Text></Pressable>)}</View>}<Button text="Schedule notification" onPress={schedule} /></Panel><ListHeading title="Scheduled" onClear={async () => { await Notifications.cancelAllScheduledNotificationsAsync(); refresh(); }} /><FlatList scrollEnabled={false} data={items} keyExtractor={(x) => x.identifier} ListEmptyComponent={<Empty text="No notifications yet." />} renderItem={({ item }) => <Item title={item.content.body} meta={describeRequest(item)} action="Cancel" onAction={async () => { await Notifications.cancelScheduledNotificationAsync(item.identifier); refresh(); }} />} /></ScrollView>;
}

function LastTimeTool() {
  const [items, setItems] = useStored(KEYS.last, []); const [name, setName] = useState(''); const [editing, setEditing] = useState(null); const [sort, setSort] = useState('oldest'); const [date, setDate] = useState(new Date());
  const save = () => { if (!name.trim()) return; const item = { id: editing?.id || id(), name: name.trim(), completedAt: (editing ? date : new Date()).toISOString() }; setItems((current) => editing ? current.map((x) => x.id === editing.id ? item : x) : [item, ...current]); setName(''); setEditing(null); };
  const ordered = [...items].sort((a, b) => sort === 'recent' ? new Date(b.completedAt) - new Date(a.completedAt) : new Date(a.completedAt) - new Date(b.completedAt));
  return <ScrollView contentContainerStyle={styles.content}><Panel><Text style={styles.label}>{editing ? 'Edit item' : 'Add item'}</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="e.g. Changed bedsheets" placeholderTextColor="#98A2B3" />{editing && <><Text style={styles.label}>Last completed</Text><DateTimePicker mode="datetime" value={date} onChange={(_, d) => d && setDate(d)} /></>}<Button text={editing ? 'Save changes' : 'Add item'} onPress={save} />{editing && <Button text="Cancel" secondary onPress={() => { setEditing(null); setName(''); }} />}</Panel><View style={styles.inline}><Text style={styles.sectionTitle}>Tracked items</Text><View style={styles.row}><Choice selected={sort === 'oldest'} title="Longest ago" onPress={() => setSort('oldest')} /><Choice selected={sort === 'recent'} title="Recent" onPress={() => setSort('recent')} /></View></View>{ordered.length ? ordered.map((item) => <Item key={item.id} title={item.name} meta={`${relative(item.completedAt)} • ${dateTime(new Date(item.completedAt))}`} action="Done now" onAction={() => setItems((x) => x.map((v) => v.id === item.id ? { ...v, completedAt: new Date().toISOString() } : v))} secondAction="Edit" onSecond={() => { setEditing(item); setName(item.name); setDate(new Date(item.completedAt)); }} onDelete={() => setItems((x) => x.filter((v) => v.id !== item.id))} />) : <Empty text="Add the things you want to remember." />}</ScrollView>;
}

function CountdownTool() {
  const [items, setItems] = useStored(KEYS.countdown, []); const [title, setTitle] = useState(''); const [target, setTarget] = useState(() => defaultDate()); const [editing, setEditing] = useState(null);
  const save = () => { if (!title.trim()) return; const item = { id: editing?.id || id(), title: title.trim(), target: target.toISOString(), favorite: editing?.favorite || false }; setItems((x) => editing ? x.map((v) => v.id === editing.id ? item : v) : [...x, item]); setTitle(''); setEditing(null); };
  return <ScrollView contentContainerStyle={styles.content}><Panel><Text style={styles.label}>{editing ? 'Edit countdown' : 'New countdown'}</Text><TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g. Vacation" placeholderTextColor="#98A2B3" /><DateTimePicker mode="datetime" value={target} onChange={(_, d) => d && setTarget(d)} /><Button text={editing ? 'Save changes' : 'Add countdown'} onPress={save} /></Panel><Text style={styles.sectionTitle}>Your countdowns</Text>{items.length ? items.sort((a, b) => Number(b.favorite) - Number(a.favorite)).map((item) => <CountdownCard key={item.id} item={item} onFavorite={() => setItems((x) => x.map((v) => v.id === item.id ? { ...v, favorite: !v.favorite } : v))} onEdit={() => { setEditing(item); setTitle(item.title); setTarget(new Date(item.target)); }} onDelete={() => setItems((x) => x.filter((v) => v.id !== item.id))} />) : <Empty text="Add an event to start counting down." />}</ScrollView>;
}
function CountdownCard({ item, onFavorite, onEdit, onDelete }) { const remaining = countdown(item.target); return <View style={styles.card}><View style={styles.inline}><View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.bigNumber}>{remaining.done ? 'Past' : `${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`}</Text><Text style={styles.muted}>{dateTime(new Date(item.target))}</Text></View><Pressable onPress={onFavorite}><Text style={styles.star}>{item.favorite ? '★' : '☆'}</Text></Pressable></View><View style={styles.actions}><Button small secondary text="Edit" onPress={onEdit} /><Button small danger text="Delete" onPress={onDelete} /></View></View>; }

function GroceryTool() {
  const [data, setData] = useStored(KEYS.groceries, { activeDate: today(), lists: {} }); const [input, setInput] = useState(''); const [history, setHistory] = useState(false); const active = ensureToday(data); const list = active.lists[active.activeDate] || []; const suggestions = input.length > 1 ? groceryNames(data).filter((x) => x.toLowerCase().startsWith(input.toLowerCase())).slice(0, 4) : [];
  useEffect(() => { if (active !== data) setData(active); }, [data.activeDate]);
  const update = (next) => setData({ ...active, lists: { ...active.lists, [active.activeDate]: next } }); const add = (value = input) => { if (!value.trim()) return; update([...list, { id: id(), name: value.trim(), done: false }]); setInput(''); }; const edit = (item) => Alert.prompt('Edit item', undefined, (value) => value?.trim() && update(list.map((x) => x.id === item.id ? { ...x, name: value.trim() } : x)), 'plain-text', item.name);
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.inline}><View><Text style={styles.sectionTitle}>{history ? 'Grocery history' : 'Today\'s groceries'}</Text><Text style={styles.muted}>{active.activeDate}</Text></View><Button small secondary text={history ? 'Today' : 'History'} onPress={() => setHistory(!history)} /></View>{history ? <History data={active} onCopy={(old) => { update([...list, ...old.map((x) => ({ ...x, id: id() }))]); setHistory(false); }} /> : <><View style={styles.addRow}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => add()} style={[styles.input, styles.flex]} placeholder="Add grocery item" placeholderTextColor="#98A2B3" /><Button small text="Add" onPress={() => add()} /></View>{suggestions.map((x) => <Pressable key={x} onPress={() => add(x)} style={styles.suggestion}><Text>{x}</Text></Pressable>)}{list.map((item) => <View key={item.id} style={styles.groceryRow}><Pressable onPress={() => update(list.map((x) => x.id === item.id ? { ...x, done: !x.done } : x))} style={[styles.checkbox, item.done && styles.checkboxDone]}><Text>{item.done ? '✓' : ''}</Text></Pressable><Text style={[styles.groceryName, item.done && styles.done]}>{item.name}</Text><Pressable onPress={() => edit(item)}><Text style={styles.link}>Edit</Text></Pressable><Pressable onPress={() => update(list.filter((x) => x.id !== item.id))}><Text style={styles.deleteText}>×</Text></Pressable></View>)}</>}</ScrollView>;
}
function History({ data, onCopy }) { const [query, setQuery] = useState(''); const days = Object.keys(data.lists).filter((x) => x !== data.activeDate).sort().reverse(); return <><TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Search old items" placeholderTextColor="#98A2B3" />{days.map((day) => { const items = data.lists[day].filter((x) => !query || x.name.toLowerCase().includes(query.toLowerCase())); return items.length ? <View key={day} style={styles.card}><Text style={styles.cardTitle}>{day}</Text>{items.map((x) => <Text key={x.id} style={styles.historyItem}>{x.done ? '✓ ' : '• '}{x.name}</Text>)}<Button small secondary text="Copy all to today" onPress={() => onCopy(data.lists[day])} /></View> : null; })}</>; }

function ApiTool() {
  const [actions, setActions] = useStored(KEYS.api, []); const [editing, setEditing] = useState(null); const blank = { name: '', description: '', url: '', method: 'GET', headers: '', body: '', contentType: 'application/json', timeout: '15000' }; const [form, setForm] = useState(blank); const [result, setResult] = useState(null); const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const save = () => { if (!form.name.trim() || !form.url.trim()) return Alert.alert('Name and URL required'); const value = { ...form, id: editing?.id || id() }; setActions((x) => editing ? x.map((a) => a.id === editing.id ? value : a) : [...x, value]); setForm(blank); setEditing(null); }; async function run(action) { setResult({ id: action.id, loading: true }); const started = Date.now(); try { const headers = await resolveHeaders(action.headers); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Number(action.timeout) || 15000); const response = await fetch(action.url, { method: action.method, headers, body: ['GET', 'DELETE'].includes(action.method) ? undefined : action.body || undefined, signal: controller.signal }); clearTimeout(timer); const text = await response.text(); let body; try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { body = text; } setResult({ id: action.id, status: response.status, ms: Date.now() - started, body }); } catch (error) { setResult({ id: action.id, error: error.message }); } }
  return <ScrollView contentContainerStyle={styles.content}><Panel><Text style={styles.label}>{editing ? 'Edit API action' : 'New API action'}</Text><TextInput value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} style={styles.input} placeholder="Name" placeholderTextColor="#98A2B3" /><TextInput value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} style={styles.input} placeholder="Description (optional)" placeholderTextColor="#98A2B3" /><TextInput autoCapitalize="none" value={form.url} onChangeText={(v) => setForm({ ...form, url: v })} style={styles.input} placeholder="https://example.com/health" placeholderTextColor="#98A2B3" /><View style={styles.segment}>{methods.map((m) => <Pressable key={m} onPress={() => setForm({ ...form, method: m })} style={[styles.segmentItem, form.method === m && styles.segmentSelected]}><Text style={form.method === m ? styles.segmentTextSelected : styles.segmentText}>{m}</Text></Pressable>)}</View><TextInput autoCapitalize="none" value={form.headers} onChangeText={(v) => setForm({ ...form, headers: v })} style={styles.inputTall} placeholder={'Headers, one per line\nAuthorization: Bearer {{SERVER_TOKEN}}'} placeholderTextColor="#98A2B3" /><TextInput autoCapitalize="none" value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} style={styles.inputTall} placeholder="Request body (optional)" placeholderTextColor="#98A2B3" /><TextInput keyboardType="numeric" value={form.timeout} onChangeText={(v) => setForm({ ...form, timeout: v })} style={styles.input} placeholder="Timeout in ms" placeholderTextColor="#98A2B3" /><Button text="Save action" onPress={save} /></Panel><Text style={styles.note}>Use {'{{NAME}}'} in headers for a Keychain secret. Save secrets with the button below; they are never stored in normal app storage.</Text><Button secondary text="Save a Keychain secret" onPress={() => Alert.prompt('Secret name', 'Example: SERVER_TOKEN', async (key) => { if (key?.trim()) Alert.prompt('Secret value', undefined, async (value) => { if (value != null) { await SecureStore.setItemAsync(key.trim(), value); Alert.alert('Saved securely'); } }, 'secure-text'); })} />{actions.map((action) => <View key={action.id} style={styles.card}><Text style={styles.cardTitle}>{action.name}</Text>{action.description ? <Text style={styles.muted}>{action.description}</Text> : null}<Text style={styles.mono}>{action.method} {action.url}</Text><View style={styles.actions}><Button small text="Run" onPress={() => run(action)} /><Button small secondary text="Edit" onPress={() => { setEditing(action); setForm(action); }} /><Button small danger text="Delete" onPress={() => setActions((x) => x.filter((a) => a.id !== action.id))} /></View>{result?.id === action.id && <View style={styles.result}>{result.loading ? <Text>Running...</Text> : result.error ? <Text style={styles.error}>{result.error}</Text> : <Text style={styles.mono}>{result.status} - {result.ms} ms{`\n`}{result.body}</Text>}</View>}</View>)}</ScrollView>;
}

const homePalette = {
  light: {
    accent: '#0A84FF',
    accentSoft: '#DCEEFF',
    background: '#F3F6FA',
    badge: 'rgba(255,255,255,0.78)',
    border: 'rgba(15,23,42,0.08)',
    card: 'rgba(255,255,255,0.92)',
    handle: 'rgba(15,23,42,0.045)',
    hero: 'rgba(255,255,255,0.82)',
    nav: 'rgba(255,255,255,0.86)',
    secondaryText: '#667085',
    success: '#34C759',
    tertiaryText: '#98A2B3',
    text: '#101828',
    toast: 'rgba(255,255,255,0.96)',
    shadow: { elevation: 5, shadowColor: '#3D4B63', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.08, shadowRadius: 24 },
  },
  dark: {
    accent: '#64D2FF',
    accentSoft: 'rgba(100,210,255,0.18)',
    background: '#070A12',
    badge: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.10)',
    card: 'rgba(28,33,45,0.92)',
    handle: 'rgba(255,255,255,0.07)',
    hero: 'rgba(24,31,43,0.86)',
    nav: 'rgba(10,14,24,0.90)',
    secondaryText: '#A8B1C1',
    success: '#30D158',
    tertiaryText: '#778195',
    text: '#F8FAFC',
    toast: 'rgba(29,34,46,0.96)',
    shadow: { elevation: 0, shadowColor: '#000000', shadowOffset: { height: 16, width: 0 }, shadowOpacity: 0.32, shadowRadius: 28 },
  },
};

const toolPresentation = {
  api: { accent: '#7C3AED', soft: 'rgba(124,58,237,0.14)', symbol: 'curlybraces' },
  checklist: { accent: '#34C759', soft: 'rgba(52,199,89,0.15)', symbol: 'checkmark.circle.fill' },
  countdown: { accent: '#FF9F0A', soft: 'rgba(255,159,10,0.16)', symbol: 'calendar.badge.clock' },
  default: { accent: '#0A84FF', soft: 'rgba(10,132,255,0.14)', symbol: 'square.grid.2x2.fill' },
  groceries: { accent: '#30D158', soft: 'rgba(48,209,88,0.15)', symbol: 'cart.fill' },
  last: { accent: '#5E5CE6', soft: 'rgba(94,92,230,0.14)', symbol: 'clock.arrow.circlepath' },
  people: { accent: '#FF375F', soft: 'rgba(255,55,95,0.14)', symbol: 'person.2.fill' },
  receipts: { accent: '#BF5AF2', soft: 'rgba(191,90,242,0.14)', symbol: 'doc.text.image.fill' },
  reminders: { accent: '#0A84FF', soft: 'rgba(10,132,255,0.14)', symbol: 'bell.badge.fill' },
  wheel: { accent: '#FF453A', soft: 'rgba(255,69,58,0.14)', symbol: 'dice.fill' },
};

function softHaptic() {
  if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});
}

function mediumHaptic() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function DashboardStatic({ onOpen }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = dark ? homePalette.dark : homePalette.light;
  const [order, setOrder] = useStored(EXTRA_KEYS.toolOrder, tools.map((tool) => tool.id));
  const orderedTools = order
    .map((toolId) => tools.find((tool) => tool.id === toolId))
    .filter(Boolean)
    .concat(tools.filter((tool) => !order.includes(tool.id)));

  const openTool = (toolId) => {
    softHaptic();
    onOpen(toolId);
  };

  return <View style={[homeStyles.screen, { backgroundColor: palette.background }]}>
    <DraggableFlatList
      data={orderedTools}
      keyExtractor={(item) => item.id}
      activationDistance={16}
      dragItemOverflow
      contentContainerStyle={homeStyles.listContent}
      ListHeaderComponent={<HomeHeader palette={palette} toolCount={tools.length} />}
      ListFooterComponent={<Text style={[homeStyles.footer, { color: palette.tertiaryText }]}>Order syncs locally on this device.</Text>}
      onDragBegin={() => mediumHaptic()}
      onDragEnd={({ data }) => {
        setOrder(data.map((tool) => tool.id));
        softHaptic();
      }}
      renderItem={({ item, drag, isActive }) => (
        <ShadowDecorator>
          <ScaleDecorator activeScale={1.02}>
            <HomeToolRow
              item={item}
              palette={palette}
              isActive={isActive}
              onOpen={() => openTool(item.id)}
              onDrag={() => {
                mediumHaptic();
                drag();
              }}
            />
          </ScaleDecorator>
        </ShadowDecorator>
      )}
    />
  </View>;
}

function ToastBanner({ message }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = dark ? homePalette.dark : homePalette.light;
  return <View pointerEvents="none" style={[homeStyles.toast, { backgroundColor: palette.toast, borderColor: palette.border }, palette.shadow]}>
    <SymbolView name="checkmark.circle.fill" size={17} type="hierarchical" tintColor={palette.success} fallback={<Text style={[homeStyles.toastFallback, { color: palette.success }]}>OK</Text>} />
    <Text numberOfLines={2} style={[homeStyles.toastText, { color: palette.text }]}>{message}</Text>
  </View>;
}

function HomeHeader({ palette, toolCount }) {
  return <View style={homeStyles.homeHeader}>
    <View style={homeStyles.homeTopBar}>
      <View>
        <Text style={[homeStyles.homeEyebrow, { color: palette.accent }]}>EVERYDAY TOOLBOX</Text>
        <Text style={[homeStyles.homeTitle, { color: palette.text }]}>Toolbox</Text>
      </View>
      <View style={[homeStyles.homeBadge, { backgroundColor: palette.badge, borderColor: palette.border }]}>
        <SymbolView name="square.grid.2x2.fill" size={16} type="hierarchical" tintColor={palette.accent} fallback={<Text style={[homeStyles.symbolFallback, { color: palette.accent }]}>#</Text>} />
        <Text style={[homeStyles.homeBadgeText, { color: palette.text }]}>{toolCount}</Text>
      </View>
    </View>
    <View style={homeStyles.sectionRow}>
      <Text style={[homeStyles.sectionHeading, { color: palette.text }]}>Tools</Text>
      <Text style={[homeStyles.sectionHint, { color: palette.tertiaryText }]}>Hold ≡ to drag</Text>
    </View>
  </View>;
}

function HomeToolRow({ item, palette, isActive, onOpen, onDrag }) {
  const meta = toolPresentation[item.id] || toolPresentation.default;
  return <View style={[homeStyles.toolRowCard, { backgroundColor: palette.card, borderColor: isActive ? meta.accent : palette.border }, isActive && homeStyles.toolRowActive, palette.shadow]}>
    <Pressable onPress={onOpen} style={({ pressed }) => [homeStyles.toolOpenArea, pressed && homeStyles.homePressed]}>
      <View style={[homeStyles.toolIconWrap, { backgroundColor: meta.soft }]}>
        <SymbolView name={meta.symbol} size={24} type="hierarchical" tintColor={meta.accent} fallback={<Text style={[homeStyles.symbolFallback, { color: meta.accent }]}>{item.icon}</Text>} />
      </View>
      <View style={homeStyles.toolTextBlock}>
        <Text numberOfLines={1} style={[homeStyles.toolTitle, { color: palette.text }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[homeStyles.toolDescription, { color: palette.secondaryText }]}>{item.description}</Text>
      </View>
      <SymbolView name="chevron.right" size={15} weight="semibold" tintColor={palette.tertiaryText} fallback={<Text style={[homeStyles.chevronFallback, { color: palette.tertiaryText }]}>›</Text>} />
    </Pressable>
    <Pressable onLongPress={onDrag} delayLongPress={140} hitSlop={12} style={({ pressed }) => [homeStyles.dragHandle, { backgroundColor: palette.handle }, pressed && homeStyles.dragHandlePressed]}>
      <SymbolView name="line.3.horizontal" size={18} weight="semibold" tintColor={palette.tertiaryText} fallback={<Text style={[homeStyles.dragFallback, { color: palette.tertiaryText }]}>≡</Text>} />
    </Pressable>
  </View>;
}
function ToolFrameStatic({ title, onBack, children }) { const scheme = useColorScheme(); const palette = scheme === 'dark' ? homePalette.dark : homePalette.light; const responder = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 18 && Math.abs(gesture.dy) < 24, onPanResponderRelease: (_, gesture) => { if (gesture.dx > 70) onBack(); } })).current; return <View style={[styles.flex, { backgroundColor: palette.background }]} {...responder.panHandlers}><View style={[styles.nav, { backgroundColor: palette.nav, borderBottomColor: palette.border }]}><Pressable onPress={() => { softHaptic(); onBack(); }} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={[styles.backText, { color: palette.accent }]}>‹</Text></Pressable><Text style={[styles.navTitle, { color: palette.text }]}>{title}</Text></View><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><TouchableWithoutFeedback onPress={Keyboard.dismiss}><View style={styles.flex}>{children}</View></TouchableWithoutFeedback></KeyboardAvoidingView></View>; }
function RandomWheelToolV2() { const [saved, setSaved] = useStored(EXTRA_KEYS.wheel, ['Ali', 'Kenneth', 'Camilla', 'Peter', 'Mads']); const [entries, setEntries] = useState(saved); const [input, setInput] = useState(''); const [winner, setWinner] = useState(''); const [rotation, setRotation] = useState(0); const [spinning, setSpinning] = useState(false); const spinTimer = useRef(null); const size = 280; const radius = 124; const colors = ['#1677FF', '#F59E0B', '#059669', '#DB2777', '#7C3AED', '#0891B2']; useEffect(() => { setEntries(saved); }, [saved]); useEffect(() => () => spinTimer.current && clearTimeout(spinTimer.current), []); const add = () => { const values = input.split(/\n|,/).map((x) => x.trim()).filter(Boolean); if (values.length) { setEntries((x) => [...x, ...values]); setInput(''); } }; const spin = (remove = false) => { const spinEntries = [...entries]; if (spinning || spinEntries.length < 2) return; const index = Math.floor(Math.random() * spinEntries.length); const segment = 360 / spinEntries.length; const landingOffset = (Math.random() - 0.5) * segment * 0.72; const targetAtTop = 360 - index * segment - segment / 2 + landingOffset; const extraTurns = 5 + Math.floor(Math.random() * 4); setWinner(''); setSpinning(true); setRotation((current) => current + extraTurns * 360 + targetAtTop - positiveModulo(current, 360)); if (spinTimer.current) clearTimeout(spinTimer.current); spinTimer.current = setTimeout(() => { const selected = spinEntries[index]; setWinner(selected); setSpinning(false); if (remove) setEntries((current) => removeEntryAtSnapshotIndex(current, spinEntries, index)); }, 3200); }; return <ScrollView contentContainerStyle={styles.content}><View style={styles.wheelFrame}><View style={[styles.pointer, { bottom: undefined, top: 0, borderTopWidth: 22, borderBottomColor: '#BE123C', borderBottomWidth: 0 }]} /><AnimatedWheel rotation={rotation} size={size} radius={radius} entries={entries} colors={colors} /><Pressable disabled={spinning} onPress={() => spin(false)} style={styles.spinButton}><Text style={styles.spinButtonText}>{spinning ? '...' : 'SPIN'}</Text></Pressable></View>{winner ? <Text style={styles.winner}>Winner: {winner}</Text> : <Text style={styles.muted}>Add choices, then spin the wheel.</Text>}<View style={{ gap: 8, marginTop: 12 }}><View><Button text="Spin again" onPress={() => spin(false)} /></View><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Button secondary text="Remove winner & spin" onPress={() => spin(true)} /></View><View style={{ flex: 1 }}><Button danger text="Remove winner" onPress={() => { if (winner) setEntries((x) => x.filter((item) => item !== winner)); setWinner(''); }} /></View></View></View><Panel><TextInput multiline value={input} onChangeText={setInput} style={styles.inputTall} placeholder="Add names, one per line" placeholderTextColor="#98A2B3" /><View style={styles.actions}><Button small text="Add entries" onPress={add} /><Button small secondary text="Reset" onPress={() => { setEntries(saved); setWinner(''); }} /><Button small danger text="Clear" onPress={() => { setEntries([]); setWinner(''); }} /></View></Panel>{entries.map((entry, index) => <View key={`${entry}-${index}`} style={styles.inline}><Text>{entry}</Text><Pressable onPress={() => setEntries((x) => x.filter((_, i) => i !== index))}><Text style={styles.deleteText}>×</Text></Pressable></View>)}<Button secondary text="Save current list as preset" onPress={() => setSaved(entries)} /></ScrollView>; }
function AnimatedWheel({ rotation, size, radius, entries, colors }) { const animated = useMemo(() => new Animated.Value(rotation), []); useEffect(() => { Animated.timing(animated, { toValue: rotation, duration: 3200, useNativeDriver: true }).start(); }, [rotation]); const paths = wheelPaths(entries.length, size / 2, size / 2, radius); return <Animated.View style={{ transform: [{ rotate: animated.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }}><Svg width={size} height={size}>{paths.map((path, index) => <SvgPath key={index} d={path.d} fill={colors[index % colors.length]} stroke="#FFFFFF" strokeWidth="2" />)}{entries.map((entry, index) => { const p = paths[index]; return <SvgText key={`${entry}-label`} x={p.labelX} y={p.labelY} fill="#FFFFFF" fontSize="12" fontWeight="700" textAnchor="middle" transform={`rotate(${p.angle} ${p.labelX} ${p.labelY})`}>{entry.slice(0, 12)}</SvgText>; })}</Svg></Animated.View>; }
function wheelPaths(count, cx, cy, radius) { if (!count) return []; const segment = 360 / count; return Array.from({ length: count }, (_, index) => { const start = index * segment - 90; const end = start + segment; const startPoint = polar(cx, cy, radius, start); const endPoint = polar(cx, cy, radius, end); const label = polar(cx, cy, radius * 0.62, start + segment / 2); return { d: `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${segment > 180 ? 1 : 0} 1 ${endPoint.x} ${endPoint.y} Z`, labelX: label.x, labelY: label.y, angle: start + segment / 2 + 90 }; }); }
function polar(cx, cy, radius, angle) { const radians = angle * Math.PI / 180; return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }; }
function positiveModulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }
function removeEntryAtSnapshotIndex(current, snapshot, index) { const selected = snapshot[index]; const occurrence = snapshot.slice(0, index + 1).filter((entry) => entry === selected).length; let seen = 0; return current.filter((entry) => { if (entry !== selected) return true; seen += 1; return seen !== occurrence; }); }

function Panel({ children }) { const scheme = useColorScheme(); const palette = scheme === 'dark' ? homePalette.dark : homePalette.light; return <View style={[styles.panel, { backgroundColor: palette.card, borderColor: palette.border }, palette.shadow]}>{children}</View>; } function Button({ text, onPress, secondary, danger, small, toast }) { const showToast = useToast(); const handlePress = async () => { softHaptic(); const result = onPress?.(); if (result?.then) await result; if (toast) showToast(toast); }; return <Pressable onPress={handlePress} style={({ pressed }) => [styles.button, small && styles.buttonSmall, secondary && styles.buttonSecondary, danger && styles.buttonDanger, pressed && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, danger && styles.buttonDangerText]}>{text}</Text></Pressable>; } function Choice({ selected, title, onPress }) { return <Pressable onPress={() => { softHaptic(); onPress?.(); }} style={[styles.choice, selected && styles.choiceSelected]}><Text style={selected ? styles.choiceTextSelected : styles.choiceText}>{title}</Text></Pressable>; } function Item({ title, meta, action, onAction, secondAction, onSecond, onDelete }) { const scheme = useColorScheme(); const palette = scheme === 'dark' ? homePalette.dark : homePalette.light; return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }, palette.shadow]}><Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.muted, { color: palette.secondaryText }]}>{meta}</Text><View style={styles.actions}><Button small text={action} onPress={onAction} />{secondAction && <Button small secondary text={secondAction} onPress={onSecond} />}{onDelete && <Button small danger text="Delete" onPress={onDelete} toast="Deleted" />}</View></View>; } function ListHeading({ title, onClear }) { const scheme = useColorScheme(); const palette = scheme === 'dark' ? homePalette.dark : homePalette.light; return <View style={styles.inline}><Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text><Button small danger text="Clear all" onPress={onClear} toast="Cleared" /></View>; } function Empty({ text }) { const scheme = useColorScheme(); const palette = scheme === 'dark' ? homePalette.dark : homePalette.light; return <View style={[styles.empty, { borderColor: palette.border }]}><Text style={[styles.muted, { color: palette.secondaryText }]}>{text}</Text></View>; }

async function resolveHeaders(raw) { const headers = {}; for (const line of raw.split('\n')) { const index = line.indexOf(':'); if (index < 1) continue; let value = line.slice(index + 1).trim(); const matches = [...value.matchAll(/\{\{([^}]+)\}\}/g)]; for (const match of matches) value = value.replace(match[0], (await SecureStore.getItemAsync(match[1])) || ''); headers[line.slice(0, index).trim()] = value; } return headers; }
function triggerFor(d, recurring, repeat) { if (!recurring) return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d }; const base = { hour: d.getHours(), minute: d.getMinutes() }; if (repeat === 'weekly') return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d.getDay() + 1, ...base }; if (repeat === 'monthly') return { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: d.getDate(), ...base }; if (repeat === 'yearly') return { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: d.getMonth() + 1, day: d.getDate(), ...base }; return { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...base }; }

const homeStyles = StyleSheet.create({
  safeDark: { backgroundColor: '#070A12' },
  screen: { flex: 1 },
  listContent: { paddingBottom: 34, paddingHorizontal: 18, paddingTop: 10 },
  footer: { fontSize: 12, fontWeight: '600', paddingBottom: 10, paddingTop: 8, textAlign: 'center' },
  homeHeader: { paddingBottom: 14 },
  homeTopBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  homeEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  homeTitle: { fontSize: 34, fontWeight: '900', letterSpacing: 0, lineHeight: 39 },
  homeBadge: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 36, paddingHorizontal: 12 },
  homeBadgeText: { fontSize: 14, fontWeight: '800' },
  symbolFallback: { fontSize: 18, fontWeight: '900' },
  heroSurface: { alignItems: 'center', borderRadius: 26, borderWidth: 1, flexDirection: 'row', gap: 14, marginBottom: 18, padding: 16 },
  heroIcon: { alignItems: 'center', borderRadius: 18, height: 56, justifyContent: 'center', width: 56 },
  heroFallback: { fontSize: 28, fontWeight: '900' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0, marginBottom: 4 },
  heroText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeading: { fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  sectionHint: { fontSize: 12, fontWeight: '700' },
  toolRowCard: { alignItems: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row', marginBottom: 10, minHeight: 76, overflow: 'hidden' },
  toolRowActive: { transform: [{ scale: 1.01 }] },
  toolOpenArea: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 13, minHeight: 76, paddingLeft: 13, paddingRight: 8 },
  homePressed: { opacity: 0.78 },
  toolIconWrap: { alignItems: 'center', borderRadius: 17, height: 48, justifyContent: 'center', width: 48 },
  toolTextBlock: { flex: 1, minWidth: 0 },
  toolTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0, marginBottom: 3 },
  toolDescription: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  chevronFallback: { fontSize: 24, fontWeight: '600' },
  dragHandle: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', minWidth: 48 },
  dragHandlePressed: { opacity: 0.65 },
  dragFallback: { fontSize: 21, fontWeight: '900' },
  receiptPreview: { position: 'relative' },
  receiptCountBadge: { alignItems: 'center', backgroundColor: 'rgba(16,24,40,0.86)', borderRadius: 10, bottom: -5, minWidth: 26, paddingHorizontal: 6, paddingVertical: 3, position: 'absolute', right: -5 },
  receiptCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  receiptStrip: { gap: 8, paddingBottom: 2, paddingTop: 4 },
  receiptThumbButton: { position: 'relative' },
  receiptThumb: { borderRadius: 8, height: 58, width: 58 },
  receiptThumbLabel: { backgroundColor: 'rgba(16,24,40,0.76)', borderRadius: 8, color: '#FFFFFF', fontSize: 10, fontWeight: '900', left: 5, minWidth: 16, overflow: 'hidden', paddingHorizontal: 4, paddingVertical: 2, position: 'absolute', textAlign: 'center', top: 5 },
  toast: { alignItems: 'center', alignSelf: 'center', borderRadius: 18, borderWidth: 1, bottom: 18, flexDirection: 'row', gap: 8, left: 18, minHeight: 48, paddingHorizontal: 14, position: 'absolute', right: 18 },
  toastFallback: { fontSize: 12, fontWeight: '900' },
  toastText: { flex: 1, fontSize: 14, fontWeight: '800', lineHeight: 18 },
});

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F7FB' }, flex: { flex: 1 }, screenVisible: { flex: 1 }, screenHidden: { display: 'none' }, content: { padding: 20, paddingBottom: 48 }, listContent: { paddingHorizontal: 20, paddingBottom: 48 }, header: { paddingBottom: 22 }, kicker: { color: '#1677FF', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 }, title: { color: '#111827', fontSize: 30, fontWeight: '800', lineHeight: 36 }, subtitle: { color: '#667085', fontSize: 16, lineHeight: 22, marginTop: 10 }, dragHint: { color: '#98A2B3', fontSize: 13, marginTop: 12 }, toolGrid: { gap: 12 }, toolRow: { gap: 12 }, toolCard: { backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 132, padding: 14, position: 'relative' }, toolCardActive: { borderColor: '#1677FF', opacity: 0.85 }, icon: { alignItems: 'center', backgroundColor: '#EEF6FF', borderRadius: 8, height: 36, justifyContent: 'center', marginBottom: 12, width: 42 }, iconText: { color: '#1677FF', fontSize: 18, fontWeight: '800' }, cardTitle: { color: '#111827', fontSize: 17, fontWeight: '800' }, cardDescription: { color: '#667085', fontSize: 14, marginTop: 5 }, chevron: { color: '#98A2B3', fontSize: 30, position: 'absolute', right: 17, top: 43 }, footerNote: { color: '#98A2B3', fontSize: 13, marginTop: 24, textAlign: 'center' }, nav: { alignItems: 'center', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 14 }, back: { height: 40, justifyContent: 'center', width: 40 }, backText: { color: '#1677FF', fontSize: 38, fontWeight: '300', lineHeight: 40 }, navTitle: { color: '#111827', fontSize: 18, fontWeight: '800' }, panel: { backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginBottom: 18, padding: 16 }, sectionLabel: { color: '#344054', fontSize: 14, fontWeight: '800', marginBottom: 8 }, sectionTitle: { color: '#111827', fontSize: 20, fontWeight: '800', marginVertical: 12 }, label: { color: '#344054', fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 10 }, muted: { color: '#667085', fontSize: 14, lineHeight: 20 }, inline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, row: { flexDirection: 'row', gap: 8 }, input: { backgroundColor: '#F8FAFC', borderColor: '#D7DEE8', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 16, minHeight: 46, marginBottom: 12, paddingHorizontal: 12 }, inputTall: { backgroundColor: '#F8FAFC', borderColor: '#D7DEE8', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 16, minHeight: 82, marginBottom: 12, padding: 12, textAlignVertical: 'top' }, button: { alignItems: 'center', backgroundColor: '#1677FF', borderRadius: 8, justifyContent: 'center', minHeight: 48, marginTop: 8, paddingHorizontal: 16 }, buttonSmall: { minHeight: 36, marginTop: 0, paddingHorizontal: 12 }, buttonSecondary: { backgroundColor: '#EEF6FF' }, buttonDanger: { backgroundColor: '#FFF1F2' }, buttonText: { color: '#FFF', fontSize: 14, fontWeight: '800' }, buttonSecondaryText: { color: '#1662C4' }, buttonDangerText: { color: '#BE123C' }, choice: { alignItems: 'center', borderColor: '#D7DEE8', borderRadius: 8, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 }, choiceSelected: { backgroundColor: '#EEF6FF', borderColor: '#1677FF' }, choiceText: { color: '#667085', fontSize: 13, fontWeight: '700' }, choiceTextSelected: { color: '#1662C4', fontSize: 13, fontWeight: '800' }, segment: { backgroundColor: '#EEF2F7', borderRadius: 8, flexDirection: 'row', gap: 4, marginVertical: 12, padding: 4 }, segmentItem: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 36 }, segmentSelected: { backgroundColor: '#FFF' }, segmentText: { color: '#667085', fontSize: 12, fontWeight: '700' }, segmentTextSelected: { color: '#111827', fontSize: 12, fontWeight: '800' }, card: { backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginBottom: 10, padding: 14 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, bigNumber: { color: '#1677FF', fontSize: 25, fontWeight: '800', marginVertical: 6 }, star: { color: '#F59E0B', fontSize: 30 }, note: { color: '#667085', fontSize: 13, lineHeight: 19, marginBottom: 14, marginTop: 4 }, mono: { color: '#344054', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18, marginTop: 8 }, result: { backgroundColor: '#F8FAFC', borderRadius: 8, marginTop: 12, padding: 12 }, error: { color: '#BE123C' }, addRow: { alignItems: 'center', flexDirection: 'row', gap: 8 }, suggestion: { backgroundColor: '#EEF6FF', borderRadius: 6, marginBottom: 4, padding: 10 }, groceryRow: { alignItems: 'center', backgroundColor: '#FFF', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52, paddingHorizontal: 10 }, draggingRow: { backgroundColor: '#EEF6FF', borderColor: '#1677FF', borderWidth: 1 }, checkbox: { alignItems: 'center', borderColor: '#98A2B3', borderRadius: 5, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 }, checkboxDone: { backgroundColor: '#D1FAE5', borderColor: '#059669' }, groceryName: { color: '#111827', flex: 1, fontSize: 16 }, done: { color: '#98A2B3', textDecorationLine: 'line-through' }, link: { color: '#1677FF', fontWeight: '700' }, deleteText: { color: '#BE123C', fontSize: 25 }, historyItem: { color: '#344054', fontSize: 15, marginBottom: 7 }, empty: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 22 }, thumbnail: { borderRadius: 8, height: 64, width: 64 }, imageViewer: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.92)', flex: 1, justifyContent: 'center' }, fullImage: { height: '90%', width: '94%' }, noteRow: { alignItems: 'center', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', gap: 8, paddingVertical: 12 }, wheelFrame: { alignItems: 'center', height: 320, justifyContent: 'center', marginBottom: 12, position: 'relative' }, pointer: { borderTopColor: '#BE123C', borderTopWidth: 22, borderLeftColor: 'transparent', borderLeftWidth: 10, borderRightColor: 'transparent', borderRightWidth: 10, height: 0, position: 'absolute', bottom: 2, width: 0, zIndex: 2 }, spinButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#111827', borderRadius: 30, borderWidth: 3, height: 60, justifyContent: 'center', position: 'absolute', width: 60 }, spinButtonText: { color: '#111827', fontSize: 12, fontWeight: '900' }, winner: { color: '#1677FF', fontSize: 24, fontWeight: '900', marginBottom: 12, textAlign: 'center' }, pressed: { opacity: 0.75 } });
