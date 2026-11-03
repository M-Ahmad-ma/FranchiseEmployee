import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Option } from '../services/utils';
import type { ModuleRow } from '../services/moduleService';

/** A lead opened from the filter list or a follow-up row. */
export interface LeadDetailParams {
  leadId: string;
  /** Passed through so the header paints before the fetch resolves. */
  investor?: string;
  phone?: string;
  company?: string;
  e_co_id?: string;
}

/** The signed-in screens: drawer sections plus detail/form screens. */
export type RootStackParamList = {
  Home: undefined;
  Requests: undefined;
  FollowUps: undefined;
  CompanyMedia: undefined;

  Brands: undefined;
  Properties: undefined;
  Reports: undefined;
  Jobs: undefined;
  Events: undefined;
  Companies: undefined;
  Users: undefined;
  Downloads: undefined;
  Franchise: undefined;
  Advertisements: undefined;
  Subscribers: undefined;
  AssignedRequests: undefined;
  InvestorRequests: undefined;
  Shows: undefined;

  Tasks: undefined;
  TaskDetail: { taskId: string };
  Meetings: undefined;
  MeetingDetail: { meetingId: string };

  LeadDetail: LeadDetailParams;
};

/**
 * The nested stack rendered inside the drawer shell.
 *
 * The drawer only lists sections, so detail screens are excluded from
 * navigation targets — they are pushed from a row, never chosen from the drawer.
 */
export type MainStackParamList = Omit<
  RootStackParamList,
  'LeadDetail' | 'TaskDetail' | 'MeetingDetail'
>;

/** Outer shell: the auth gate plus the drawer-wrapped app area. */
export type AppStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
};

export type ModuleRoute =
  | 'Brands'
  | 'Properties'
  | 'Reports'
  | 'Jobs'
  | 'Events'
  | 'Companies'
  | 'Users'
  | 'Downloads'
  | 'Franchise'
  | 'Advertisements'
  | 'Subscribers'
  | 'AssignedRequests'
  | 'InvestorRequests'
  | 'Shows';

export type ModuleGroup =
  | 'Overview'
  | 'CRM'
  | 'Directory'
  | 'Work'
  | 'Content';

export type FormFieldType = 'text' | 'multiline' | 'number' | 'select' | 'date';

export interface ModuleFormField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: FormFieldType;
  /** Which async option list this select reads. */
  optionsKey?: string;
}

export interface ModuleConfig {
  route: ModuleRoute;
  label: string;
  hint: string;
  group: ModuleGroup;
  /** Sidebar entry is shown when any of these keys is present. */
  view: string[];
  create?: string[];
  edit?: string[];
  delete?: string[];
  load: () => Promise<ModuleRow[]>;
  loadOptions?: () => Promise<Record<string, Option[]>>;
  loadEdit?: (id: string) => Promise<{
    values: Record<string, string>;
    options?: Record<string, Option[]>;
  }>;
  createFn?: (values: Record<string, string>) => Promise<unknown>;
  updateFn?: (id: string, values: Record<string, string>) => Promise<unknown>;
  deleteFn?: (id: string) => Promise<unknown>;
  fields?: ModuleFormField[];
  emptyMessage: string;
  /** A lead row opens the existing lead detail screen instead of a form. */
  opensLead?: boolean;
  /** Shows a city field before the list can load. */
  requiresCity?: boolean;
  /** A read-only detail heading for modules whose list is their only view. */
  detailTitle?: string;
}
