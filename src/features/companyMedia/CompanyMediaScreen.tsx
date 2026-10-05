import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Filter, ImageOff, RefreshCw } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SelectField } from '../../shared/components/SelectField';
import { fetchCompanies } from '../../services/companyService';
import { MEDIA_TYPE_OPTIONS } from '../../services/options';
import type { Option } from '../../services/utils';

const HELPER_TEXT =
  'The company list is live. Media types stay as reference data until a media endpoint is available.';

export function CompanyMediaScreen() {
  const [companies, setCompanies] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCompanies();
      setCompanies(rows.map(row => ({ label: row.name, value: row.id })));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reset = () => {
    setCompany(undefined);
    setMediaType(undefined);
    setError(null);
  };

  const selectedCompany = useMemo(
    () => companies.find(option => option.value === company),
    [companies, company],
  );

  return (
    <DashboardLayout
      title="Company Media"
      subtitle="View and share images/videos/PDFs/locations for companies"
      showMenu
      onRefresh={load}
      refreshing={loading}>
      <Card className="bg-white rounded-2xl p-4">
        <Text className="font-lato-bold text-lg text-neutral-900 mb-4">
          Select Company &amp; Media Type
        </Text>

        {loading ? (
          <View className="items-center py-6 mb-4">
            <ActivityIndicator size="large" color="#5279AC" />
          </View>
        ) : (
          <>
            <SelectField
              label="Select Company"
              required
              placeholder="-- Select Company --"
              value={company}
              options={companies}
              onChange={setCompany}
            />
            <SelectField
              label="Media Type"
              placeholder="-- Select Media Type (Optional) --"
              value={mediaType}
              options={MEDIA_TYPE_OPTIONS}
              onChange={setMediaType}
            />

            <View className="flex-row gap-3 mt-2">
              <Button
                title="Filter by Type"
                size="lg"
                className="flex-1"
                disabled={!company}
                loading={loading}
                icon={<Filter size={16} color="#FFFFFF" />}
                onPress={() => reset()}
              />
              <Button
                title="Reset"
                size="lg"
                variant="secondary"
                className="flex-1"
                disabled={loading}
                icon={<RefreshCw size={16} color="#FFFFFF" />}
                onPress={reset}
              />
            </View>
          </>
        )}

        <Text className="text-neutral-700 text-sm font-lato mt-3 leading-5">
          {HELPER_TEXT}
        </Text>

        {error && (
          <Text className="text-red-500 text-sm font-lato mt-3 text-center">
            {error}
          </Text>
        )}
      </Card>

      {/* Selection summary — media retrieval has no endpoint yet. */}
      {selectedCompany ? (
        <Card className="bg-white rounded-2xl p-4 mt-6">
          <Text className="font-lato-bold text-base text-neutral-900">
            {selectedCompany.label}
          </Text>
          <Text className="font-lato text-xs text-neutral-600 mt-1">
            {mediaType
              ? `Media type: ${MEDIA_TYPE_OPTIONS.find(o => o.value === mediaType)?.label ?? mediaType}`
              : 'No media type selected'}
          </Text>

          <View className="bg-tertiary-200 border border-tertiary-300 rounded-2xl px-4 py-3.5 mt-4 flex-row items-center gap-2.5">
            <ImageOff size={18} color="#0081A7" />
            <Text className="font-lato text-sm text-tertiary-900 flex-1 leading-5">
              Media for this company isn&apos;t available yet — the Team API
              exposes no media endpoint yet.
            </Text>
          </View>
        </Card>
      ) : null}
    </DashboardLayout>
  );
}
