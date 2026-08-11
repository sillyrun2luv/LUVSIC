/**
 * 赞赏收款码配置
 *
 * === 使用方法 ===
 * 1. 在 GitHub 建一个公开仓库（如 donate-assets）
 * 2. 把支付宝/微信收款码图片上传到仓库根目录
 *    - 文件名建议：donate-alipay.png / donate-wechat.png
 * 3. 把下面的 URL 中的 {用户名}/{仓库名} 替换成你的
 *    URL 格式：https://cdn.jsdelivr.net/gh/{用户名}/{仓库名}@{分支}/{文件路径}
 *    例：https://cdn.jsdelivr.net/gh/octocat/donate-assets@main/donate-alipay.png
 *
 * === 换图流程（无需改代码、无需发版） ===
 * 1. 把新收款码图片推到 GitHub 仓库（覆盖同名文件）
 * 2. 浏览器访问以下链接手动刷新 CDN 缓存（每次换图都要做）：
 *    https://purge.jsdelivr.net/gh/{用户名}/{仓库名}@main/donate-alipay.png
 *    https://purge.jsdelivr.net/gh/{用户名}/{仓库名}@main/donate-wechat.png
 * 3. 用户重新打开赞赏弹窗即可看到新图（最多等 5 分钟全球节点同步）
 *
 * === 未配置时的兜底 ===
 * URL 留空字符串 "" 时，赞赏弹窗会显示「二维码即将上线」占位图，
 * 不会报错也不会白屏。
 */

// jsDelivr CDN 链接（GitHub 仓库 sillyrun2luv/LUVSIC）
export const DONATE_ALIPAY_URL = "https://cdn.jsdelivr.net/gh/sillyrun2luv/LUVSIC@main/donate-alipay.png";
export const DONATE_WECHAT_URL = "https://cdn.jsdelivr.net/gh/sillyrun2luv/LUVSIC@main/donate-wechat.png";

// 赞赏文案（如需修改直接改这里）
export const DONATE_TITLE = "如果它陪你度过了一些时刻";
export const DONATE_SUBTITLE = "App 功能完全免费，我只是一个讨口子 OVO（非强制付费）";
export const DONATE_FOOTER = "长按图片可保存到相册 · 祝大家冲得愉快~";
