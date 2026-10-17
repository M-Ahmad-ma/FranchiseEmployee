import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Check, ChevronDown, Search } from 'lucide-react-native';
import type { Option } from '../../services/utils';

interface Props {
  label?: string;
  required?: boolean;
  placeholder: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Compact pill trigger — used for inline controls like "Records per page". */
  compact?: boolean;
  prefix?: string;
  modalTitle?: string;
  testID?: string;
  /**
   * The option list is still in flight. The trigger stays visible but inert so a
   * tap cannot open a modal with nothing in it, and the chevron is replaced by a
   * spinner so the field reads as busy rather than broken.
   */
  loading?: boolean;
  /** Shows a type-to-filter box above the list. Worth it on the long lists. */
  searchable?: boolean;
  /** Label for the filter box; defaults to "Search". */
  searchPlaceholder?: string;
}

export function SelectField({
  label,
  required = false,
  placeholder,
  value,
  options,
  onChange,
  className = '',
  style,
  compact = false,
  prefix,
  modalTitle,
  testID,
  loading = false,
  searchable = false,
  searchPlaceholder = 'Search',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  const closeModal = () => {
    setOpen(false);
    // The query is per-visit state: clearing it here means reopening the modal
    // starts from the full list rather than the previous filter.
    setQuery('');
    Keyboard.dismiss();
  };

  const openModal = () => {
    if (loading) {
      return;
    }
    setOpen(true);
  };

  const visibleOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter(option => option.label.toLowerCase().includes(term));
  }, [options, query]);

  /** Nothing loaded yet, or nothing matched the query — say so. */
  const emptyMessage = query.trim()
    ? `No matches for "${query.trim()}"`
    : loading
      ? 'Loading options…'
      : 'No options available';

  const selectorModal = (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
      statusBarTranslucent>
      <View className="flex-1 bg-black/30 justify-center px-6">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeModal}
          accessibilityLabel="Close selector"
        />
        <View className="bg-white rounded-3xl p-4 max-h-[70%]">
          <Text className="font-lato-bold text-base px-2 pt-2 pb-1 text-neutral-900">
            {modalTitle ?? label ?? 'Select'}
          </Text>

          {searchable && options.length > SEARCH_THRESHOLD ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-100 px-3 py-2 mt-1 mb-2">
              <Search size={16} color="#8990A8" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor="#8990A8"
                autoCorrect={false}
                autoCapitalize="none"
                className="flex-1 font-lato text-sm text-neutral-900"
                // The list re-renders on every keystroke, so this keeps typing
                // smooth on the longer lists.
                returnKeyType="search"
              />
              {query ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search">
                  <Text className="font-lato-bold text-xs text-primary-700">
                    Clear
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#5279AC" />
              </View>
            ) : visibleOptions.length === 0 ? (
              <Text className="font-lato text-sm text-neutral-500 text-center py-10 px-4">
                {emptyMessage}
              </Text>
            ) : (
              visibleOptions.map(option => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChange(option.value);
                      closeModal();
                    }}
                    className="py-3 border-b border-neutral-200 flex-row items-center justify-between">
                    <Text
                      className={
                        isSelected
                          ? 'font-lato-bold text-base text-primary-700 flex-1'
                          : 'font-lato text-base text-neutral-900 flex-1'
                      }>
                      {option.label}
                    </Text>
                    {isSelected && <Check size={16} color="#5279AC" />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={closeModal}
            className="items-end border-t border-neutral-200 mt-2 pt-3">
            <Text className="text-primary-700 font-lato-bold text-base px-2 pb-1">
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <TouchableOpacity
          testID={testID}
          activeOpacity={0.8}
          disabled={loading}
          onPress={openModal}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          className="flex-row items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5">
          <Text className="font-lato text-xs text-neutral-700">
            {prefix ? `${prefix} ` : ''}
            {displayLabel}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color="#8990A8" />
          ) : (
            <ChevronDown size={14} color="#8990A8" />
          )}
        </TouchableOpacity>
        {selectorModal}
      </>
    );
  }

  return (
    <View className={`mb-4 ${className}`} style={style}>
      {label && (
        <Text className="text-neutral-700 font-lato-bold text-xs mb-1.5 ml-1">
          {label}
          {required ? ' *' : ''}
        </Text>
      )}
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.8}
        disabled={loading}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading, busy: loading }}
        className="bg-white rounded-2xl px-4 py-3.5 border border-neutral-200 flex-row items-center justify-between">
        <Text
          className={`font-lato text-base flex-1 ${
            selected ? 'text-neutral-900' : 'text-neutral-400'
          }`}
          numberOfLines={1}>
          {displayLabel}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#8990A8" />
        ) : (
          <ChevronDown size={18} color="#8990A8" />
        )}
      </TouchableOpacity>
      {selectorModal}
    </View>
  );
}

/**
 * Above this many options a search box earns its space. Below it the box would
 * be more chrome than the list it filters, so the modal just scrolls.
 */
const SEARCH_THRESHOLD = 8;
