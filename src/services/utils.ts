import { MOCK_DELAY_MS } from '../config';

export const delay = (ms: number = MOCK_DELAY_MS) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

export interface Option {
  label: string;
  value: string;
}
