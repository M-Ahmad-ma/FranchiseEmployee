import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Handshake,
  MapPin,
  MessageSquare,
  Phone,
  Tag,
  Video,
} from 'lucide-react-native';
import { cardShadow } from '../../shared/components/Card';
import {
  MEETING_TYPE_LABELS,
  dealDoneLabel,
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

  // Mirrors pickPrimary: only an explicit "0" counts as closed, so an
  // unrecognised status reads as still scheduled rather than done.
  const meetingOpen = meeting ? meeting.status !== '0' : false;

  // Type only, no date and no count. A count beside it read as "increment
  // this" rather than "this lead has more meetings", and the lead detail
  // screen already lists every meeting in full.
  const meetingLabel = meeting
    ? meetingKind(meeting) || (meetingOpen ? 'Scheduled' : 'Done')
    : '';

  // The lead's own `meeting_type`. Only worth a chip when it says something the
  // meeting chip does not — otherwise the card carries two identical chips.
  const typeLabel = meetingTypeLabel(row.meetingType);
  const showTypeChip = Boolean(typeLabel) && typeLabel !== meetingLabel;

  const dealLabel = dealDoneLabel(row.dealDone);

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
      {/* ---------- Name, stage, chevron ---------- */}
      <View className="flex-row items-center gap-2">
        <Text
          className="font-lato-bold text-base text-neutral-900 flex-1"
          numberOfLines={1}>
          {investor}
        </Text>

        {row.pipelineLabel ? (
          <View className="rounded-full bg-primary-200 px-3 py-1 max-w-[45%]">
            <Text
              className="font-lato-bold text-[11px] text-primary-700"
              numberOfLines={1}>
              {row.pipelineLabel}
            </Text>
          </View>
        ) : null}

        <ChevronRight size={16} color="#A3ABC4" />
      </View>

      {/* ---------- Brand, city ---------- */}
      {location ? (
        <View className="flex-row items-center gap-1.5 mt-1.5">
          <MapPin size={12} color="#8990A8" />
          <Text
            className="font-lato text-xs text-neutral-600 flex-1"
            numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}

      {/* ---------- Phone ---------- */}
      {row.phone ? (
        <View className="flex-row items-center gap-1.5 mt-2">
          <Phone size={13} color="#5279AC" />
          <Text
            className="font-lato text-sm text-neutral-900 flex-1"
            numberOfLines={1}>
            {row.phone}
          </Text>
        </View>
      ) : null}

      {/* ---------- Date, meeting, stage, deal ---------- */}
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
          <Chip label={`Type: ${typeLabel}`} tone="primary" icon={Tag} />
        ) : null}

        {dealLabel ? (
          <Chip
            label={`Deal: ${dealLabel}`}
            tone={dealLabel === 'Yes' ? 'success' : 'neutral'}
            icon={Handshake}
          />
        ) : null}
      </View>

      {/* ---------- Request comment ---------- */}
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
