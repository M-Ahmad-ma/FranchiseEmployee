import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, MapPin, Plus, X } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DateField } from '../../shared/components/DateField';
import { DetailRow, DetailSection } from '../../shared/components/RecordDetails';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  createEvent,
  fetchEvents,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { IMAGE_BASE, pickString, toApiDate } from '../../services/utils';

interface EventRecord {
  id: string;
  title: string;
  image: string;
  about: string;
  address: string;
  date: string;
  time: string;
  toDate: string;
  toTime: string;
  createdDate: string;
  createdTime: string;
  updatedDate: string;
  updatedTime: string;
  raw: Record<string, unknown>;
}

function normalizeEvent(row: ModuleRow): EventRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['e_id', 'event_id', 'id']),
    title:
      pickString(raw, ['e_name', 'title', 'event_title', 'name']) || row.title,
    image: pickString(raw, ['e_image', 'image', 'event_image']),
    about: pickString(raw, ['e_about', 'description', 'event_description']),
    address: pickString(raw, [
      'e_address',
      'venue',
      'event_venue',
      'location',
    ]),
    date: pickString(raw, ['e_date', 'date', 'event_date']),
    time: pickString(raw, ['e_time', 'time', 'event_time']),
    toDate: pickString(raw, ['e_to_date', 'end_date']),
    toTime: pickString(raw, ['e_to_time', 'end_time']),
    createdDate: pickString(raw, ['e_created_date', 'created_at']),
    createdTime: pickString(raw, ['e_created_time', 'created_time']),
    updatedDate: pickString(raw, ['e_updated_date', 'updated_at']),
    updatedTime: pickString(raw, ['e_updated_time', 'updated_time']),
    raw,
  };
}

function eventTimeRange(event: EventRecord): string {
  const start = [event.date, event.time].filter(Boolean).join(' · ');
  const end = [event.toDate, event.toTime].filter(Boolean).join(' · ');
  if (!end || end === start) {
    return start || 'Date not set';
  }
  return `${start || 'Start not set'} → ${end}`;
}

interface EventForm {
  title: string;
  date: string;
  venue: string;
}

const EMPTY_FORM: EventForm = { title: '', date: '', venue: '' };

export function EventsScreen() {
  const { can } = useAuth();
  const canCreate = can(P.eventsAdd);

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchEvents(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await load(true);
    } finally {
      setPullRefreshing(false);
    }
  }, [load]);

  const events = useMemo(() => rows.map(normalizeEvent), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return events;
    }
    return events.filter(event =>
      [event.title, event.address, event.date, event.about, event.image]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [events, query]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setFormError(null);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setFormError('Event title is required.');
      return;
    }
    const date = toApiDate(form.date);
    if (!date) {
      setFormError('Pick a valid date.');
      return;
    }
    if (!form.venue.trim()) {
      setFormError('Venue is required.');
      return;
    }

    setFormSaving(true);
    setFormError(null);
    try {
      await createEvent({
        title: form.title.trim(),
        date,
        venue: form.venue.trim(),
      });
      setFormOpen(false);
      await load(true);
    } catch (saveError) {
      setFormError(describeApiError(saveError, 'Could not add this event.'));
    } finally {
      setFormSaving(false);
    }
  };



  console.log(filtered)
  return (
    <DashboardLayout
      title="vents"
      subtitle="Events, expos and meetups"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search events"
          placeholder="Title, venue, category or date"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${events.length} event${events.length === 1 ? '' : 's'
            }`}
        />
      </Card>

      <View className="flex-row items-center justify-between gap-3 mb-4">
        <Badge label={`${filtered.length} shown`} tone="neutral" />
        {canCreate ? (
          <Button
            title="Add event"
            size="sm"
            icon={<Plus size={14} color="#FFFFFF" />}
            onPress={openCreate}
          />
        ) : null}
      </View>

      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : filtered.length === 0 ? (
        <AlertBanner
          message={
            events.length === 0
              ? 'No events found.'
              : 'No events match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(event => (
            <Card
              key={event.id || event.title}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(event)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${event.title}`}>
                <View className="flex-row items-start gap-3">
                  <View>
                    <Image source={{ uri: `${IMAGE_BASE}/${event.image}` }} className='w-12 h-12 rounded-2xl' />
                  </View>
                  {/* <EventImage */}
                  {/*   image={event.image} */}
                  {/*   title={event.title} */}
                  {/*   width={64} */}
                  {/*   height={64} */}
                  {/* /> */}
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {event.title}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      {eventTimeRange(event)}
                    </Text>
                    {event.address ? (
                      <Text
                        className="font-lato text-xs text-neutral-600 mt-1"
                        numberOfLines={2}>
                        {event.address}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {event.about ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {event.about}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(event)}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {filtered.length > visibleCount ? (
        <Button
          title={`Show ${Math.min(20, filtered.length - visibleCount)} more`}
          size="lg"
          variant="outlined"
          className="mb-3"
          onPress={() => setVisibleCount(current => current + 20)}
        />
      ) : null}

      {selected ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setSelected(null)}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[88%] px-5 pt-5 pb-6">
              <View className="flex-row items-center justify-between gap-3 mb-4">
                <View className="flex-1">
                  <Text className="font-lato-black text-lg text-neutral-900">
                    {selected.title}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    Event #{selected.id}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close event details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {selected.image ? (
                  <View className="items-center mb-4">
                    <Image source={{ uri: `${IMAGE_BASE}/${selected.image}` }} className='w-full h-28' />
                  </View>
                ) : null}

                <DetailSection title="Schedule">
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Starts"
                    value={
                      [selected.date, selected.time]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Ends"
                    value={
                      [selected.toDate, selected.toTime]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="Address"
                    value={selected.address || '—'}
                  />
                </DetailSection>

                {selected.about ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      About this event
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.about}
                    </Text>
                  </View>
                ) : null}

                <View className="pt-3 mt-3 border-t border-neutral-200">
                  <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mb-1.5">
                    Record
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600">
                    Created:{' '}
                    {[selected.createdDate, selected.createdTime]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    Updated:{' '}
                    {[selected.updatedDate, selected.updatedTime]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                  {selected.image ? (
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      Image: {selected.image}
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {formOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={closeForm}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[92%]">
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                <Text className="font-lato-black text-lg text-neutral-900">
                  Add event
                </Text>
                <TouchableOpacity
                  onPress={closeForm}
                  disabled={formSaving}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close form">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                className="px-5">
                <TextField
                  label="Event title"
                  required
                  value={form.title}
                  onChangeText={value =>
                    setForm(current => ({ ...current, title: value }))
                  }
                />
                <DateField
                  label="Date"
                  required
                  value={form.date}
                  onChange={value =>
                    setForm(current => ({ ...current, date: value }))
                  }
                />
                <TextField
                  label="Venue"
                  required
                  placeholder="Where is the event?"
                  value={form.venue}
                  onChangeText={value =>
                    setForm(current => ({ ...current, venue: value }))
                  }
                />

                {formError ? (
                  <Text className="text-red-500 text-sm font-lato mb-3 text-center">
                    {formError}
                  </Text>
                ) : null}
              </ScrollView>

              <View className="flex-row gap-3 px-5 pt-2 pb-6">
                <Button
                  title="Cancel"
                  size="lg"
                  variant="secondary"
                  className="flex-1"
                  disabled={formSaving}
                  onPress={closeForm}
                />
                <Button
                  title="Add event"
                  size="lg"
                  className="flex-1"
                  loading={formSaving}
                  onPress={() => void submit()}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}
