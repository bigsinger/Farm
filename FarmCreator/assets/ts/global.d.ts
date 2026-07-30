// global.d.ts — 全局类型定义
// 所有共享的接口/类型集中在此，避免各文件重复定义

/** 好友信息 */
interface FriendInfo {
    id: string;
    name: string;
    level: number;
    gold?: number;
    lastOnline: number;
    visitCount: number;
    isOnline?: boolean;
}

/** 天气类型 */
type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'snowy' | 'foggy';

/** 季节类型 */
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
