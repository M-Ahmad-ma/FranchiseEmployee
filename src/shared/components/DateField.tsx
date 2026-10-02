import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

const format = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}/${date.getFullYear()}`;

const parse = (value?: string) => {
  if (value) {
    const [month, day, year] = value.split('/').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }
  return new Date();
};

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

export function DateField({
  label,
  required = false,
  value,
  onChange,
  placeholder = 'mm/dd/yyyy',
  className = '',
  style,
  testID,
}: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const openPicker = () => {
    setTempDate(parse(value));
    setShow(true);
  };

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (event.type === 'set' && date) {
      setTempDate(date);
      onChange(format(date));
    }
  };

  const confirmIos = () => {
    onChange(format(tempDate));
    setShow(false);
  };

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
          className={`font-lato text-base flex-1 ${
            value ? 'text-neutral-900' : 'text-neutral-500'
          }`}>
          {value ?? placeholder}
        </Text>
        <Calendar size={18} color="#8990A8" />
      </TouchableOpacity>

      {show && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="fade"
          onRequestClose={() => setShow(false)}
          statusBarTranslucent>
          <View className="flex-1 bg-black/30 justify-center px-6">
            <View className="bg-white rounded-3xl p-4">
              <Text className="font-lato-bold text-base px-2 pt-2 pb-1 text-neutral-900">
                {label ?? 'Select date'}
              </Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                themeVariant="light"
              />
              <View className="flex-row justify-end gap-4 border-t border-neutral-200 mt-2 pt-3 px-2">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShow(false)}>
                  <Text className="text-neutral-600 font-lato-bold text-base">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} onPress={confirmIos}>
                  <Text className="text-primary-700 font-lato-bold text-base">
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
