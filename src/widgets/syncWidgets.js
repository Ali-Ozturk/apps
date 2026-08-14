import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { EXTRA_KEYS, KEYS } from '../constants';
import { dateTime, remainingLabel, relative, today, time, cap } from '../utils/date';
import { ensureToday } from '../utils/lists';

const WIDGETS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_WIDGETS === '1';

export async function syncWidgets() {
  if (!WIDGETS_ENABLED || Platform.OS !== 'ios' || __DEV__) return;

  try {
    let ToolboxOverviewWidget;
    let ToolboxCountdownWidget;
    try {
      ToolboxOverviewWidget = require('../../widgets/ToolboxOverviewWidget').default;
      ToolboxCountdownWidget = require('../../widgets/ToolboxCountdownWidget').default;
    } catch {
      return;
    }

    const [lastRaw, countdownRaw, groceriesRaw, checklistRaw, scheduled] = await Promise.all([
      AsyncStorage.getItem(KEYS.last),
      AsyncStorage.getItem(KEYS.countdown),
      AsyncStorage.getItem(KEYS.groceries),
      AsyncStorage.getItem(EXTRA_KEYS.checklist),
      Notifications.getAllScheduledNotificationsAsync(),
    ]);

    const lastItems = lastRaw ? JSON.parse(lastRaw) : [];
    const countdownItems = countdownRaw ? JSON.parse(countdownRaw) : [];
    const groceries = groceriesRaw ? ensureToday(JSON.parse(groceriesRaw)) : { activeDate: today(), lists: {} };
    const groceryItems = groceries.lists[groceries.activeDate] || [];
    const checklist = checklistRaw ? JSON.parse(checklistRaw) : { date: today(), items: [] };
    const checklistItems = checklist.date === today() ? checklist.items : checklist.items.map((item) => ({ ...item, done: false }));
    const nextCountdown = countdownItems
      .filter((item) => new Date(item.target) > new Date())
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(a.target) - new Date(b.target))[0];
    const oldestLast = [...lastItems].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))[0];
    const nextReminder = scheduled
      .map((item) => ({ item, date: item.content?.data?.at ? new Date(item.content.data.at) : null }))
      .filter((entry) => entry.date && entry.date > new Date())
      .sort((a, b) => a.date - b.date)[0];

    ToolboxOverviewWidget.updateSnapshot({
      groceryTotal: groceryItems.length,
      groceryDone: groceryItems.filter((item) => item.done).length,
      checklistTotal: checklistItems.length,
      checklistDone: checklistItems.filter((item) => item.done).length,
      lastTitle: oldestLast?.name || '',
      lastRelative: oldestLast ? relative(oldestLast.completedAt) : '',
      nextReminderTitle: nextReminder?.item.content?.body || '',
    });

    if (nextCountdown) {
      const entries = Array.from({ length: 25 }, (_, index) => {
        const at = new Date(Date.now() + index * 60 * 60 * 1000);
        return { date: at, props: { title: nextCountdown.title, target: dateTime(new Date(nextCountdown.target)), remaining: remainingLabel(nextCountdown.target, at) } };
      });
      ToolboxCountdownWidget.updateTimeline(entries);
    } else {
      ToolboxCountdownWidget.updateSnapshot({ title: '', target: '', remaining: '' });
    }
  } catch (error) {
    console.warn('Widget sync unavailable', error);
  }
}

export function describeRequest(request) {
  const data = request.content?.data || {};
  const prefix = data.style === 'alarm' ? 'Alarm-like • ' : '';
  return data.repeat && data.repeat !== 'daily' && data.repeat !== 'once'
    ? `${prefix}${cap(data.repeat)} at ${time(data.at)}`
    : `${prefix}${data.at ? dateTime(data.at) : 'Scheduled notification'}`;
}
