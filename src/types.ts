// 一条自我行为记录
export interface RecordEntry {
  id: string;
  timestamp: number; // 发生时间戳（毫秒）
  duration: number; // 时长（分钟）
  forms: string[]; // 刺激形式：视频、音频、文字、想象…
  tools: string[]; // 辅助道具：手、玩具、其他…
  note?: string; // 备注，可选
  createdAt: number; // 记录创建时间戳
  /**
   * true = 计时按钮产生的（真实使用时长，计入排行榜）
   * false = "记录一次"表单手动补录的（仅本地回看，不上榜）
   */
  isTimerEntry: boolean;
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
  showFloatingTimer: boolean; // 是否显示右下角浮动计时按钮
}

export type ViewKey = "overview" | "record" | "friends" | "profile";

// 好友关系状态
export type FriendshipStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Friendship {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendshipStatus;
  createdAt: number;
  updatedAt: number;
}

/** 搜索 / 列表里显示的其他用户（仅公开信息，不含任何隐私数据） */
export interface PublicUser {
  userId: string;
  name: string;
  avatar: string;
  /** 当前登录用户与对方的关系 */
  relation: "stranger" | "pending_from_me" | "pending_to_me" | "friend" | "self";
}

/** 用户隐私设置（保存在 user_profile 扩展字段里，云同步） */
export interface PrivacySettings {
  /** 是否允许被昵称搜索（默认 true） */
  searchable: boolean;
  /** 是否允许好友查看我的聚合统计（总次数/总时长，阶段 2/3 排行榜用） */
  showAggregatesToFriends: boolean;
}
