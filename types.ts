export interface UserSettings {
  apiKey: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  immersionRate: number; // 0-100 percentage of words to try and replace
  customVocabulary: string[];
}

export interface ReplacementItem {
  original: string;
  replacement: string;
  context: string;
}

export type ExtensionMessage = 
  | { type: 'START_IMMERSION'; settings: UserSettings }
  | { type: 'RESET_PAGE' }
  | { type: 'SCAN_COMPLETE'; count: number };
