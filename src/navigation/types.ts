import type { NavigatorScreenParams } from '@react-navigation/native';

/** The authenticated app area — every screen reachable once signed in. */
export type RootStackParamList = {
  Home: undefined;
  Requests: undefined;
  Tasks: undefined;
  CompanyMedia: undefined;
};

/** The nested stack rendered inside the drawer shell. */
export type MainStackParamList = RootStackParamList;

/** Outer shell: the auth gate plus the drawer-wrapped app area. */
export type AppStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
};