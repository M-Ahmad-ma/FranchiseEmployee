import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Filter, RefreshCw } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SelectField } from '../../shared/components/SelectField';
import { fetchCompanyMedia } from '../../services/companyMediaService';
import { COMPANY_OPTIONS, MEDIA_TYPE_OPTIONS } from '../../services/options';

export function CompanyMediaScreen() {
  const [company, setCompany] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFilter = async () => {
    if (!company) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchCompanyMedia({ company, mediaType });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCompany(undefined);
    setMediaType(undefined);
    setError(null);
  };

  return (
    <DashboardLayout
      title="Company Media"
      subtitle="View and share images/videos/PDFs/locations for companies"
      breadcrumbs={[
        { label: 'Home' },
        { label: 'Companies' },
        { label: 'Media' },
      ]}>
      <Card className="bg-white rounded-2xl p-4">
        <Text className="font-lato-bold text-lg text-neutral-900 mb-4">
          Select Company &amp; Media Type
        </Text>

        <SelectField
          label="Select Company"
          required
          placeholder="-- Select Company --"
          value={company}
          options={COMPANY_OPTIONS}
          onChange={setCompany}
        />
        <SelectField
          label="Media Type"
          required
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
            onPress={applyFilter}
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

        {error && (
          <Text className="text-red-500 text-sm font-lato mt-3 text-center">
            {error}
          </Text>
        )}
      </Card>
    </DashboardLayout>
  );
}
