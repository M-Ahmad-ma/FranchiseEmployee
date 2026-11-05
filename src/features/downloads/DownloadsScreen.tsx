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
import {
  CalendarDays,
  Download,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';
import { fetchDownloads, type ModuleRow } from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { IMAGE_BASE, pickString } from '../../services/utils';

/**
 * `GET /downloads` uses `d_*` columns rather than the generic title/category
 * shape. This screen presents the document name, description, status and file
 * details without dumping the raw row.
 */

interface DownloadRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  date: string;
  time: string;
  file: string;
  image: string;
  raw: Record<string, unknown>;
}

function normalizeDownload(row: ModuleRow): DownloadRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['d_id', 'download_id', 'id']),
    name:
      pickString(raw, ['d_name', 'title', 'name', 'file_name']) || row.title,
    description: pickString(raw, ['d_description', 'description', 'desc']),
    status: pickString(raw, ['d_status', 'status']),
    date: pickString(raw, ['d_date_added', 'date_added', 'date']),
    time: pickString(raw, ['d_time_added', 'time_added', 'time']),
    file: pickString(raw, ['d_file', 'file_name', 'file']),
    image: pickString(raw, ['d_img', 'image', 'img']),
    raw,
  };
}

function statusLabel(status: string): string {
  if (status === '1') {
    return 'Active';
  }
  if (status === '0') {
    return 'Inactive';
  }
  return status || 'Unknown';
}

export function DownloadsScreen() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DownloadRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchDownloads(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load downloads.'));
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

  const downloads = useMemo(() => rows.map(normalizeDownload), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return downloads;
    }
    return downloads.filter(item =>
      [item.name, item.description, item.file, item.date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [downloads, query]);


  console.log("download", rows)
  console.log("filter", filtered)

  return (
    <DashboardLayout
      title="Downloads"
      subtitle="Downloadable resources"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search downloads"
          placeholder="Name, description, file or date"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${downloads.length} download${downloads.length === 1 ? '' : 's'
            }`}
        />
      </Card>

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
            downloads.length === 0
              ? 'No downloads found.'
              : 'No downloads match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(item => (
            <Card
              key={item.id || item.name}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                    <Image source={{ uri: `${IMAGE_BASE}/${item.image}` }} className='w-full h-full' />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text
                        className="font-lato text-xs text-neutral-600 mt-1 leading-5"
                        numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={statusLabel(item.status)}
                    tone={item.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {item.date ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <CalendarDays size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {item.date}
                      </Text>
                    </View>
                  ) : null}
                  {item.file ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <FileText size={11} color="#5279AC" />
                      <Text
                        className="font-lato text-[11px] text-primary-700"
                        numberOfLines={1}>
                        {item.file}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(item)}
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
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-12 h-12 rounded-xl bg-primary-200 items-center justify-center">
                    <Download size={20} color="#5279AC" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Download #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close download details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                  {selected.date ? (
                    <Badge label={selected.date} tone="primary" />
                  ) : null}
                </View>

                {selected.description ? (
                  <View className="pb-3 border-b border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Description
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.description}
                    </Text>
                  </View>
                ) : null}

                <View className="pt-3">
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Added"
                    value={
                      [selected.date, selected.time]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <DetailRow
                    icon={<FileText size={15} color="#5279AC" />}
                    label="File"
                    value={selected.file || '—'}
                  />
                  <DetailRow
                    icon={<ImageIcon size={15} color="#5279AC" />}
                    label="Image"
                    value={selected.image || '—'}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2 py-2 border-b border-neutral-200">
      {icon}
      <Text className="font-lato text-xs text-neutral-600 w-20">{label}</Text>
      <Text className="font-lato text-sm text-neutral-900 flex-1">
        {value}
      </Text>
    </View>
  );
}
