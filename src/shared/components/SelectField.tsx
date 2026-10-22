import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
   * The option list is still in flight.
   *
   * The trigger stays tappable on purpose: opening the modal immediately and
   * showing a spinner inside it confirms the tap registered, which is far better
   * than swallowing the tap and leaving the field looking frozen.
   */
  loading?: boolean;
  /** Shows a type-to-filter box above the list. Worth it on the long lists. */
  searchable?: boolean;
  /** Label for the filter box; defaults to "Search". */
  searchPlaceholder?: string;
  /**
   * A line of help under the field.
   *
   * Used where the control has a secondary behaviour that is not obvious from
   * the label alone — picking the option that is already selected, for
   * instance.
   */
  hint?: string;
  /**
   * Hard disable. Unlike `loading` this never resolves on its own — used when a
   * server-side ownership check has already said the employee cannot act here.
   */
  disabled?: boolean;
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
  hint,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
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
    if (disabled) {
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

  /**
   * One row.
   *
   * Memoised because `FlatList` re-renders its rows whenever the render
   * function's identity changes, and an inline arrow is a new function on
   * every render of the field.
   */
  const renderOption = useCallback(
    ({ item }: { item: Option }) => {
      const isSelected = item.value === value;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            onChange(item.value);
            closeModal();
          }}
          className="py-3 border-b border-neutral-200 flex-row items-center justify-between"
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}>
          <Text
            className={
              isSelected
                ? 'font-lato-bold text-base text-primary-700 flex-1'
                : 'font-lato text-base text-neutral-900 flex-1'
            }>
            {item.label}
          </Text>
          {isSelected && <Check size={16} color="#5279AC" />}
        </TouchableOpacity>
      );
    },
    // `closeModal` is stable enough: it only sets state on this component.
    [value, onChange],
  );

  /**
   * The list's own height.
   *
   * `flexShrink` lets it give way when the card runs out of room, and the
   * cap keeps a long list from pushing the card past the screen. It is a
   * maximum rather than a fixed height so a short list still hugs its
   * content.
   */
  const listStyle = {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: Math.round(height * 0.55),
  };

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

          {loading ? (
            // The modal opens straight away on tap, so this is what fills the
            // gap while the list arrives — the tap always visibly registers.
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#5279AC" />
              <Text className="font-lato text-xs text-neutral-500 mt-3">
                Loading options…
              </Text>
            </View>
          ) : (
            /*
             * A FlatList, not a ScrollView.
             *
             * A ScrollView renders every one of its children, so a dropdown
             * holding a few hundred cities built a native view for each of
             * them the moment the modal opened — and the modal could not be
             * drawn until that was done, which is what made the tap feel
             * slow. FlatList only mounts the rows on screen.
             */
            <FlatList
              data={visibleOptions}
              keyExtractor={option => option.value}
              renderItem={renderOption}
              style={listStyle}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              ListEmptyComponent={
                <Text className="font-lato text-sm text-neutral-500 text-center py-10 px-4">
                  {emptyMessage}
                </Text>
              }
            />
          )}

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
          disabled={disabled}
          onPress={openModal}
          accessibilityRole="button"
          accessibilityState={{ busy: loading, disabled }}
          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${disabled
            ? 'border-neutral-100 bg-neutral-100'
            : 'border-neutral-200 bg-white'
            }`}>
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
        disabled={disabled}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled }}
        className={`rounded-2xl px-4 py-3.5 border flex-row items-center justify-between ${disabled
          ? 'border-neutral-100 bg-neutral-100'
          : 'border-neutral-200 bg-white'
          }`}>
        <Text
          className={`font-lato text-base flex-1 ${selected ? 'text-neutral-900' : 'text-neutral-400'
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
      {hint ? (
        <Text className="text-neutral-700 font-lato text-xs mt-1.5 ml-1">
          {hint}
        </Text>
      ) : null}
      {selectorModal}
    </View>
  );
}

/**
 * Above this many options a search box earns its space. Below it the box would
 * be more chrome than the list it filters, so the modal just scrolls.
 */
const SEARCH_THRESHOLD = 8;
