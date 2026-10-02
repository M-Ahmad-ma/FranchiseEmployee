import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
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
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  const closeModal = () => setOpen(false);

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
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(option => {
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
            })}
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
          onPress={() => setOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5"
          accessibilityRole="button">
          <Text className="font-lato text-xs text-neutral-700">
            {prefix ? `${prefix} ` : ''}
            {displayLabel}
          </Text>
          <ChevronDown size={14} color="#8990A8" />
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
        onPress={() => setOpen(true)}
        className="bg-white rounded-2xl px-4 py-3.5 border border-neutral-200 flex-row items-center justify-between"
        accessibilityRole="button">
        <Text
          className={`font-lato text-base flex-1 ${
            selected ? 'text-neutral-900' : 'text-neutral-400'
          }`}
          numberOfLines={1}>
          {displayLabel}
        </Text>
        <ChevronDown size={18} color="#8990A8" />
      </TouchableOpacity>
      {selectorModal}
    </View>
  );
}
