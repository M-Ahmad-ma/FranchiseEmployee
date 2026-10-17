import type { NavigatorScreenParams } from '@react-navigation/native';

/** A lead opened from the filter list or a follow-up row. */
export interface LeadDetailParams {
  leadId: string;
  /** Passed through so the header paints before the fetch resolves. */
  investor?: string;
  phone?: string;
  company?: string;
  e_co_id?: string;
}

/** The signed-in screens: four drawer sections plus one detail screen. */
export type RootStackParamList = {
  Home: undefined;
  Requests: undefined;
  FollowUps: undefined;
  CompanyMedia: undefined;
  LeadDetail: LeadDetailParams;
};

/**
 * The nested stack rendered inside the drawer shell.
 *
 * The drawer only lists the four sections, so `LeadDetail` is excluded from
 * navigation targets — it is pushed from a row, never chosen from the drawer.
 */
export type MainStackParamList = Omit<RootStackParamList, 'LeadDetail'>;

/** Outer shell: the auth gate plus the drawer-wrapped app area. */
export type AppStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
};
