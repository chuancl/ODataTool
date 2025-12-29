export interface UserSettings {
  // 难度设置
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  // 沉浸率：0-100，表示尝试替换单词的百分比
  immersionRate: number; 
  // 用户自定义词汇表
  customVocabulary: string[];
}

export interface ReplacementItem {
  original: string;    // 原文中文字符
  replacement: string; // 替换后的英文单词
  context: string;     // 上下文（可选）
}

export type ExtensionMessage = 
  | { type: 'START_IMMERSION'; settings: UserSettings } // 开始沉浸式学习
  | { type: 'RESET_PAGE' }                              // 重置页面
  | { type: 'SCAN_COMPLETE'; count: number };           // 扫描完成
