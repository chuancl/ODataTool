import { browser } from 'wxt/browser';
import { AppSettings, DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'odata_explorer_settings';

export const getSettings = async (): Promise<AppSettings> => {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || DEFAULT_SETTINGS;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
};

export const isWhitelisted = (url: string, whitelist: string[]): boolean => {
  return whitelist.some(item => url.includes(item));
};
