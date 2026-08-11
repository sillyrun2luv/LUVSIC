// 一条自我行为记录
export interface RecordEntry {
  id: string;
  timestamp: number; // 发生时间戳（毫秒）
  duration: number; // 时长（分钟）
  forms: string[]; // 刺激形式：视频、音频、文字、想象…
  tools: string[]; // 辅助道具：手、玩具、其他…
  note?: string; // 备注，可选
  createdAt: number; // 记录创建时间戳
}

export type ReminderMode = "daily" | "weekly" | "interval";

export interface ReminderConfig {
  enabled: boolean;
  sound: boolean; // 是否播放提示音
  mode: ReminderMode; // 提醒频率模式
  time: string; // "HH:mm" 格式，daily / weekly 模式用
  weekdays: number[]; // weekly 模式：0=周日,1=周一...6=周六
  intervalHours: number; // interval 模式：每隔 N 小时提醒一次
}

export interface Preset {
  id: string;
  name: string;
  forms: string[];
  tools: string[];
}

export interface LockConfig {
  enabled: boolean;
  /** 4~8 位数字密码（SHA-256 hex 摘要存储，不保存明文） */
  passwordHash?: string;
}

export interface Settings {
  forms: string[]; // 形式库（含默认 + 自定义）
  tools: string[]; // 道具库（含默认 + 自定义）
  presets: Preset[]; // 快捷预设组合
  reminder: ReminderConfig; // 每日提醒
  lock: LockConfig; // 密码锁
}

export type ViewKey = "overview" | "record" | "history" | "insights" | "calendar";
