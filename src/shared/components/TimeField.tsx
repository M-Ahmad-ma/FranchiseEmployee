import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Clock } from 'lucide-react-native';

const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, '0'),
);
/** Quarter hours are the common case; the full minute list is a tap away. */
const QUICK_MINUTES = ['00', '15', '30', '45'];
const FREE_MINUTES = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, '0'),
);

const format = (hour: string, minute: string) => `${hour}:${minute}`;

/** Accepts `HH:mm` from the API or the picker; falls back to 09:00. */
function parse(value?: string): { hour: string; minute: string } {
  const match = (value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: '09', minute: '00' };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { hour: '09', minute: '00' };
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { hour: match[1].padStart(2, '0'), minute: '00' };
  }
  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
  };
}

interface Props {
  label?: string;
  required?: boolean;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * 24-hour time picker built from plain lists.
 *
 * `DateTimePicker` is configured for dates throughout this app and has no time
 * mode here, so this is a two-column hour/minute modal instead. Minutes start
 * on a quarter-hour list with an "every minute" fallback, which keeps the
 * common cases to one tap.
 */
export function TimeField({
  label,
  required = false,
  value,
  onChange,
  placeholder = '--:--',
  className = '',
  style,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(parse(value));
  const [showAllMinutes, setShowAllMinutes] = useState(false);

  const openPicker = () => {
    setTemp(parse(value));
    // Only widen the minute list when the current value isn't on it.
    setShowAllMinutes(!QUICK_MINUTES.includes(temp.minute));
    setOpen(true);
  };

  const commit = (next: { hour: string; minute: string }) => {
    setTemp(next);
    onChange(format(next.hour, next.minute));
  };

  const closeModal = () => setOpen(false);

  const confirm = () => {
    onChange(format(temp.hour, temp.minute));
    closeModal();
  };

  const minutes = showAllMinutes ? FREE_MINUTES : QUICK_MINUTES;

  const column = (
    title: string,
    values: string[],
    selected: string,
    onSelect: (value: string) => void,
  ) => (
    <View className="flex-1">
      <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 text-center mb-1">
        {title}
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="max-h-[220px]">
        {values.map(option => {
          const active = option === selected;
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.8}
              onPress={() => onSelect(option)}
              className={`py-2.5 rounded-xl items-center ${
                active ? 'bg-primary-200' : ''
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text
                className={
                  active
                    ? 'font-lato-bold text-base text-primary-700'
                    : 'font-lato text-base text-neutral-900'
                }>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

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
        onPress={openPicker}
        className="bg-white rounded-2xl px-4 py-3.5 border border-neutral-200 flex-row items-center justify-between"
        accessibilityRole="button">
        <Text
          className={`font-lato text-base ${
            value ? 'text-neutral-900' : 'text-neutral-400'
          }`}>
          {value ?? placeholder}
        </Text>
        <Clock size={18} color="#8990A8" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
        statusBarTranslucent>
        <View className="flex-1 bg-black/30 justify-center px-6">
          <View className="bg-white rounded-3xl p-4">
            <Text className="font-lato-bold text-base text-neutral-900 px-2 pb-2">
              {label ?? 'Select time'}
            </Text>

            <View className="flex-row gap-3 px-1">
              {column('Hour', HOURS, temp.hour, hour =>
                commit({ ...temp, hour }),
              )}
              {column('Minute', minutes, temp.minute, minute =>
                commit({ ...temp, minute }),
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowAllMinutes(current => !current)}
              className="items-center py-2"
              accessibilityRole="button">
              <Text className="font-lato-bold text-xs text-primary-700">
                {showAllMinutes ? 'Show quarter hours' : 'Show every minute'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-end gap-4 border-t border-neutral-200 pt-3 px-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={closeModal}>
                <Text className="text-neutral-600 font-lato-bold text-base">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} onPress={confirm}>
                <Text className="text-primary-700 font-lato-bold text-base">
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}