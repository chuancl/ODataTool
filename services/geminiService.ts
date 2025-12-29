import { UserSettings } from '../types';

// 简单的本地词典示例
// 在实际应用中，这可以是一个更大的 JSON 文件或更复杂的匹配逻辑
const LOCAL_DICTIONARY: Record<string, string> = {
  "你好": "Hello",
  "世界": "World",
  "学习": "Study",
  "时间": "Time",
  "工作": "Work",
  "朋友": "Friend",
  "生活": "Life",
  "快乐": "Happy",
  "困难": "Difficult",
  "简单": "Simple",
  "开始": "Start",
  "结束": "End",
  "问题": "Problem",
  "答案": "Answer",
  "书籍": "Book",
  "网络": "Network",
  "计算机": "Computer",
  "语言": "Language",
  "翻译": "Translation",
  "测试": "Test"
};

/**
 * 分析文本块并返回需要替换为英文的词组列表。
 * 这里使用简单的本地字典匹配来模拟。
 */
export const analyzeTextForImmersion = async (
  text: string, 
  settings: UserSettings
): Promise<{ original: string; replacement: string }[]> => {
  
  const replacements: { original: string; replacement: string }[] = [];
  
  // 1. 优先处理用户自定义词汇 (假设用户输入格式为 "中文:English")
  // 如果用户只输入了单词，这里只是简单的演示如何处理
  settings.customVocabulary.forEach(item => {
    // 简单的假设用户可能输入 "苹果:Apple" 这样的格式，或者只是目标单词
    // 这里为了简化，我们只处理字典匹配逻辑
  });

  // 2. 遍历本地词典进行匹配
  // 注意：这是一个简单的字符串包含检查，没有复杂的自然语言处理
  Object.entries(LOCAL_DICTIONARY).forEach(([cn, en]) => {
    if (text.includes(cn)) {
      // 根据沉浸率随机决定是否替换
      // Math.random() * 100 < settings.immersionRate
      // 为了演示效果，如果设置了高沉浸率，我们倾向于替换
      if (Math.random() * 100 < settings.immersionRate) {
        replacements.push({
          original: cn,
          replacement: en
        });
      }
    }
  });

  // 模拟异步处理的延迟
  await new Promise(resolve => setTimeout(resolve, 50));

  return replacements;
};
