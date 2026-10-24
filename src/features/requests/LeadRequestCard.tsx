import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MapPin,
  MessageSquare,
  Tag,
  Video,
} from 'lucide-react-native';
import { cardShadow } from '../../shared/components/Card';
import {
  MEETING_TYPE_LABELS,
  meetingTypeLabel,
  type LeadRowWithMeetings,
} from '../../services/leadsFilterService';
import type { Meeting } from '../../services/meetingService';

/**
 * One lead request, as a card.
 *
 * Replaces the row this screen used to render in a horizontally scrolling
 * table. The table had to scroll sideways on a phone to show nine columns;
 * a card stacks the same fields down the page, so nothing is hidden off
 * screen and each row is big enough to read and tap.
 */

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type ChipTone = 'neutral' | 'primary' | 'amber' | 'success';

const chipTone: Record<ChipTone, string> = {
  neutral: 'bg-neutral-200 text-neutral-700',
  primary: 'bg-primary-200 text-primary-700',
  amber: 'bg-amber-100 text-amber-800',
  success: 'bg-[#BEFFDB] text-[#00A572]',
};

const chipIconColor: Record<ChipTone, string> = {
  neutral: '#565E74',
  primary: '#5279AC',
  amber: '#92400E',
  success: '#00A572',
};

/**
 * Label for a *meeting's* `meeting_type`.
 *
 * Deliberately not `meetingTypeLabel`, which maps a blank to "No Meeting" —
 * that wording belongs to a NULL column on the lead, which is what the filter's
 * `none` option selects. A meeting with no type recorded is simply unknown, so
 * this falls back to the venue text, and to nothing at all if that is blank too.
 */
const meetingKind = (meeting: Meeting) => {
  const code = meeting.type.trim().toLowerCase();
  if (code) {
    const label = MEETING_TYPE_LABELS[code];
    if (label) {
      return label;
    }
  }
  // Venue text is inconsistent server-side ("call", "Call ", "Lahore "), so it
  // is trimmed and title-cased rather than shown raw.
  return meeting.venue.trim().replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase());
};

function Chip({
  label,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconComponent;
}) {
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${chipTone[tone]}`}>
      {Icon ? <Icon size={11} color={chipIconColor[tone]} /> : null}
      <Text className="font-lato-bold text-[11px]" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface Props {
  row: LeadRowWithMeetings;
  onPress: (row: LeadRowWithMeetings) => void;
}

export function LeadRequestCard({ row, onPress }: Props) {
  const meeting = row.nextMeeting;

  const meetingOpen = meeting ? meeting.status !== '0' : false;


  const meetingLabel = meeting
    ? meetingKind(meeting) || (meetingOpen ? 'Scheduled' : 'Done')
    : '';

  const typeLabel = meetingTypeLabel(row.meetingType);
  const showTypeChip = Boolean(typeLabel) && typeLabel !== meetingLabel;


  const investor = row.investor.trim() || 'Unknown investor';
  const location = [row.brand, row.city].filter(Boolean).join(' · ');



  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${investor}${location ? `, ${location}` : ''}`}
      className="bg-white rounded-2xl border border-neutral-200 p-4 mb-3"
      style={cardShadow}>
      <View className="flex-row items-center gap-2">
        <Text
          className="font-lato-bold text-xl text-neutral-900 flex-1"
          numberOfLines={1}>
          {investor}
        </Text>

        <View className='flex items-center gap-1 flex-row'>
          <Text className='text-sm text-neutral-900 font-lato'>view</Text>
          <ChevronRight size={13} color="gray" />
        </View>
      </View>

      {location ? (
        <View className="flex-row items-center gap-1.5 mt-1.5">
          <MapPin size={13} color="#8990A8" />
          <Text
            className="font-lato text-sm text-neutral-900 flex-1"
            numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}



      <View className="flex-row flex-wrap gap-2 mt-3">
        {row.date ? <Chip label={row.date} icon={CalendarDays} /> : null}

        {meetingLabel ? (
          <Chip
            label={meetingLabel}
            tone={meetingOpen ? 'amber' : 'neutral'}
            icon={meetingOpen ? Video : CheckCircle2}
          />
        ) : null}

        {showTypeChip ? (
          <Chip label={`${typeLabel}`} tone="primary" icon={Tag} />
        ) : null}

        {row.pipelineLabel ? (
          <View className={`rounded-full  px-3 py-1 max-w-[45%]`}
            style={{ backgroundColor: row.pipelineColor || '', borderRadius: "0%" }}
          >
            <Text
              className="font-lato-bold text-[11px] text-white"
              numberOfLines={1}>
              {row.pipelineLabel}
            </Text>
          </View>
        ) : null}

      </View>

      {row.comment ? (
        <View className="flex-row gap-1.5 mt-3 bg-neutral-200 rounded-xl px-3 py-2">
          <MessageSquare size={12} color="#6F778E" />
          <Text
            className="font-lato text-xs text-neutral-700 flex-1 leading-4"
            numberOfLines={2}>
            {row.comment}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
