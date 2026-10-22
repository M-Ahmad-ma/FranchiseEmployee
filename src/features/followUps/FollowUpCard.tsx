import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
} from 'lucide-react-native';
import { cardShadow } from '../../shared/components/Card';
import {
  followUpState,
  type FollowUp,
  type FollowUpState,
} from '../../services/followupsService';
import { toApiDate } from '../../services/utils';

/**
 * One follow-up, as a card.
 *
 * Shared by the home preview and the notification drawer so the same
 * follow-up reads the same way wherever it appears. The drawer shows at most
 * a handful of these, so the card has to say two things at a glance: who
 * needs chasing, and by when. The status pill and the date therefore sit
 * apart — a row that tinted its *date* badge by status left a green badge
 * that could mean "done" or simply "not overdue", depending on what you read
 * into it.
 *
 * Rows are tinted by urgency rather than pipeline stage — the detail screen
 * owns stage colouring, and here the date is what drives action.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `YYYY-MM-DD` to "12 Oct 2026". Unreadable values pass through as-is. */
const formatDate = (value: string) => {
  const iso = toApiDate(value);
  if (!iso) {
    return value.trim();
  }
  const [year, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year}` : value.trim();
};

/** `HH:mm` (24h) to "10:00 AM". Unreadable values pass through as-is. */
const formatTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  const hour = Number(match[1]);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
};

/** The follow-up's date and time as one readable string. */
const formatWhen = (followUp: FollowUp) =>
  [formatDate(followUp.date), formatTime(followUp.time)]
    .filter(Boolean)
    .join(' · ');

const pillTone: Record<FollowUpState, string> = {
  done: 'bg-[#BEFFDB] text-[#00A572]',
  overdue: 'bg-secondary-200 text-secondary-700',
  active: 'bg-primary-200 text-primary-700',
};

const pillLabel: Record<FollowUpState, string> = {
  done: 'Done',
  overdue: 'Overdue',
  active: 'Active',
};

/** The leading disc carries the same urgency as the pill, one shade deeper. */
const discTone: Record<FollowUpState, { disc: string; icon: string }> = {
  done: { disc: 'bg-neutral-200', icon: '#6F778E' },
  overdue: { disc: 'bg-secondary-200', icon: '#BC5D00' },
  active: { disc: 'bg-tertiary-200', icon: '#0081A7' },
};

interface Props {
  followUp: FollowUp;
  onPress: (followUp: FollowUp) => void;
  /** Shows the follow-up comment under the contact lines. */
  showComment?: boolean;
}

export function FollowUpCard({ followUp, onPress, showComment = false }: Props) {
  const state = followUpState(followUp);

  const investor = followUp.investor.trim() || 'Unnamed lead';
  const when = formatWhen(followUp);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(followUp)}
      accessibilityRole="button"
      accessibilityLabel={`Follow up with ${investor}${when ? ` on ${when}` : ''
        }`}
      className="bg-white rounded-2xl border border-neutral-200 p-4 mb-3"
      style={cardShadow}>
      {/* ---------- Name, status, chevron ---------- */}
      <View className="flex-row items-center gap-3">
        <View
          className={`w-9 h-9 rounded-full items-center justify-center ${discTone[state].disc
            }`}>
          <PhoneCall size={16} color={discTone[state].icon} />
        </View>

        <Text
          className="font-lato-bold text-base text-neutral-900 flex-1"
          numberOfLines={1}>
          {investor}
        </Text>

        <View className={`rounded-full px-3 py-1 ${pillTone[state]}`}>
          <Text className="font-lato-bold text-[11px]">
            {pillLabel[state]}
          </Text>
        </View>

        <ChevronRight size={16} color="#A3ABC4" />
      </View>

      {/* ---------- When ---------- */}
      <View className="flex-row items-center gap-1.5 mt-3">
        <CalendarDays size={13} color="#5279AC" />
        <Text
          className="font-lato text-sm text-neutral-900"
          numberOfLines={1}>
          {when || 'No date set'}
        </Text>
      </View>

      {/* ---------- Contact ---------- */}
      {followUp.phone ? (
        <View className="flex-row items-center gap-1.5 mt-2">
          <Phone size={13} color="#5279AC" />
          <Text
            className="font-lato text-sm text-neutral-700 flex-1"
            numberOfLines={1}>
            {followUp.phone}
          </Text>
        </View>
      ) : null}



      {/* ---------- Comment ---------- */}
      {showComment && followUp.comment ? (
        <View className="flex-row gap-1.5 mt-3 bg-neutral-200 rounded-xl px-3 py-2">
          <MessageSquare size={12} color="#6F778E" />
          <Text
            className="font-lato text-xs text-neutral-700 flex-1 leading-4"
            numberOfLines={2}>
            {followUp.comment}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
