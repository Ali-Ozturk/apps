import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const repeatOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const defaultMessage = 'This is a message created by the user';

export default function App() {
  const [message, setMessage] = useState(defaultMessage);
  const [scheduledAt, setScheduledAt] = useState(() => getDefaultDate());
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState('daily');
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [scheduledNotifications, setScheduledNotifications] = useState([]);

  useEffect(() => {
    refreshPermissionStatus();
    refreshScheduledNotifications();
  }, []);

  const scheduleSummary = useMemo(() => {
    if (!isRecurring) {
      return `One time on ${formatDateTime(scheduledAt)}`;
    }

    return `${capitalize(repeatEvery)} at ${formatTime(scheduledAt)}`;
  }, [isRecurring, repeatEvery, scheduledAt]);

  async function refreshPermissionStatus() {
    const permissions = await Notifications.getPermissionsAsync();
    setPermissionStatus(permissions.status);
  }

  async function requestNotificationPermission() {
    const permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });

    setPermissionStatus(permissions.status);
    return permissions.status === 'granted';
  }

  async function refreshScheduledNotifications() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    const sortedRequests = [...requests].sort((a, b) =>
      describeRequest(a).localeCompare(describeRequest(b))
    );
    setScheduledNotifications(sortedRequests);
  }

  async function scheduleNotification() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      Alert.alert('Message required', 'Enter the text that should appear in the notification.');
      return;
    }

    const hasPermission =
      permissionStatus === 'granted' || (await requestNotificationPermission());

    if (!hasPermission) {
      Alert.alert(
        'Notifications disabled',
        'Allow notifications for this app in iOS Settings, then try again.'
      );
      return;
    }

    const trigger = buildTrigger(scheduledAt, isRecurring, repeatEvery);

    if (!isRecurring && scheduledAt.getTime() <= Date.now()) {
      Alert.alert('Choose a future time', 'One-time notifications must be scheduled in the future.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminder',
        body: trimmedMessage,
        sound: true,
        data: {
          repeatEvery: isRecurring ? repeatEvery : 'once',
          scheduledAt: scheduledAt.toISOString(),
        },
      },
      trigger,
    });

    setMessage(defaultMessage);
    await refreshScheduledNotifications();

    Alert.alert('Notification scheduled', scheduleSummary);
  }

  async function cancelNotification(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await refreshScheduledNotifications();
  }

  async function cancelAllNotifications() {
    if (scheduledNotifications.length === 0) {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await refreshScheduledNotifications();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <FlatList
          contentContainerStyle={styles.content}
          data={scheduledNotifications}
          keyExtractor={(item) => item.identifier}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <Text style={styles.title}>Notification Scheduler</Text>
                <Text style={styles.subtitle}>Create local iOS reminders with custom timing.</Text>
              </View>

              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.label}>Notification access</Text>
                    <Text style={styles.hint}>{formatPermission(permissionStatus)}</Text>
                  </View>
                  <Pressable style={styles.secondaryButton} onPress={requestNotificationPermission}>
                    <Text style={styles.secondaryButtonText}>Allow</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  multiline
                  onChangeText={setMessage}
                  placeholder="Type the notification message"
                  placeholderTextColor="#8A94A6"
                  style={styles.messageInput}
                  value={message}
                />

                <Text style={styles.label}>Date</Text>
                <View style={styles.pickerFrame}>
                  <DateTimePicker
                    display="inline"
                    mode="date"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setScheduledAt(mergeDateAndTime(selectedDate, scheduledAt));
                      }
                    }}
                    value={scheduledAt}
                  />
                </View>

                <Text style={styles.label}>Time</Text>
                <View style={styles.pickerFrame}>
                  <DateTimePicker
                    display="spinner"
                    mode="time"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setScheduledAt(mergeDateAndTime(scheduledAt, selectedDate));
                      }
                    }}
                    value={scheduledAt}
                  />
                </View>

                <View style={styles.repeatHeader}>
                  <View>
                    <Text style={styles.label}>Recurring</Text>
                    <Text style={styles.hint}>{scheduleSummary}</Text>
                  </View>
                  <Switch onValueChange={setIsRecurring} value={isRecurring} />
                </View>

                {isRecurring ? (
                  <View style={styles.segmentedControl}>
                    {repeatOptions.map((option) => {
                      const selected = repeatEvery === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setRepeatEvery(option.value)}
                          style={[styles.segment, selected && styles.segmentSelected]}
                        >
                          <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <Pressable style={styles.primaryButton} onPress={scheduleNotification}>
                  <Text style={styles.primaryButtonText}>Schedule Notification</Text>
                </Pressable>
              </View>

              <View style={styles.listTitleRow}>
                <Text style={styles.listTitle}>Scheduled</Text>
                <Pressable
                  disabled={scheduledNotifications.length === 0}
                  onPress={cancelAllNotifications}
                  style={({ pressed }) => [
                    styles.clearButton,
                    scheduledNotifications.length === 0 && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.clearButtonText}>Clear all</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>Create one above and iOS will deliver it locally.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.notificationItem}>
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationMessage}>{item.content.body}</Text>
                <Text style={styles.notificationMeta}>{describeRequest(item)}</Text>
              </View>
              <Pressable
                onPress={() => cancelNotification(item.identifier)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildTrigger(date, isRecurring, repeatEvery) {
  if (!isRecurring) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    };
  }

  const hour = date.getHours();
  const minute = date.getMinutes();

  if (repeatEvery === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: date.getDay() + 1,
      hour,
      minute,
    };
  }

  if (repeatEvery === 'monthly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: date.getDate(),
      hour,
      minute,
    };
  }

  if (repeatEvery === 'yearly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour,
      minute,
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

function getDefaultDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

function mergeDateAndTime(dateSource, timeSource) {
  const merged = new Date(dateSource);
  merged.setHours(timeSource.getHours());
  merged.setMinutes(timeSource.getMinutes());
  merged.setSeconds(0);
  merged.setMilliseconds(0);
  return merged;
}

function formatDateTime(date) {
  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${formatTime(date)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function describeRequest(request) {
  const repeatEvery = request.content?.data?.repeatEvery;
  const scheduledAt = request.content?.data?.scheduledAt;

  if (repeatEvery && repeatEvery !== 'once') {
    const date = scheduledAt ? new Date(scheduledAt) : null;
    return `${capitalize(repeatEvery)}${date ? ` at ${formatTime(date)}` : ''}`;
  }

  if (scheduledAt) {
    return `One time on ${formatDateTime(new Date(scheduledAt))}`;
  }

  return 'Scheduled notification';
}

function formatPermission(status) {
  if (status === 'granted') {
    return 'Allowed';
  }

  if (status === 'denied') {
    return 'Denied in iOS Settings';
  }

  if (status === 'checking') {
    return 'Checking';
  }

  return 'Not requested';
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    paddingBottom: 18,
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#5B6472',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 19,
  },
  messageInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    minHeight: 96,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  pickerFrame: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
  },
  repeatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  segmentedControl: {
    backgroundColor: '#EEF2F7',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentText: {
    color: '#5B6472',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: '#111827',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1677FF',
    borderRadius: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#EEF6FF',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1662C4',
    fontSize: 15,
    fontWeight: '800',
  },
  listTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  listTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: '#C2410C',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.35,
  },
  emptyState: {
    alignItems: 'center',
    borderColor: '#D9E2EC',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#667085',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  notificationItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  notificationCopy: {
    flex: 1,
  },
  notificationMessage: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  notificationMeta: {
    color: '#667085',
    fontSize: 13,
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelButtonText: {
    color: '#BE123C',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
