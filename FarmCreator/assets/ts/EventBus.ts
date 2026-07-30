import { EventTarget } from 'cc';
import { DEBUG } from 'cc/env';

/**
 * 游戏事件类型
 */
export enum GameEvent {
    // 货币事件
    GOLD_CHANGED = 'gold_changed',
    GOLD_ADDED = 'gold_added',
    GOLD_SPENT = 'gold_spent',
    
    // 经验事件
    EXP_GAINED = 'exp_gained',
    LEVEL_UP = 'level_up',
    
    // 作物事件
    CROP_PLANTED = 'crop_planted',
    CROP_GROWTH = 'crop_growth',
    CROP_MATURED = 'crop_matured',
    CROP_HARVESTED = 'crop_harvested',
    CROP_DIED = 'crop_died',
    
    // 仓库事件
    WAREHOUSE_ADDED = 'warehouse_added',
    WAREHOUSE_REMOVED = 'warehouse_removed',
    WAREHOUSE_SOLD = 'warehouse_sold',
    WAREHOUSE_CHANGED = 'warehouse_changed',
    
    // 商店事件
    SHOP_ITEM_BOUGHT = 'shop_item_bought',
    SHOP_UNLOCKED = 'shop_unlocked',

    // 订单事件
    MARKET_ORDER_COMPLETED = 'market_order_completed',
    MARKET_ORDERS_REFRESHED = 'market_orders_refreshed',
    
    // 任务事件
    TASK_ACCEPTED = 'task_accepted',
    TASK_COMPLETED = 'task_completed',
    TASK_REWARD_CLAIMED = 'task_reward_claimed',
    DAILY_TASK_RESET = 'daily_task_reset',
    
    // 成就事件
    ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
    ACHIEVEMENT_PROGRESS = 'achievement_progress',
    
    // 系统事件
    GAME_SAVED = 'game_saved',
    GAME_LOADED = 'game_loaded',
    GAME_PAUSED = 'game_paused',
    GAME_RESUMED = 'game_resumed',
    
    // UI事件
    UI_OPEN = 'ui_open',
    UI_CLOSE = 'ui_close',
    UI_TOGGLE = 'ui_toggle',

    // 天气事件
    WEATHER_CHANGED = 'weather_changed',

    // 好友事件
    FRIEND_ADDED = 'friend_added',
    FRIEND_REMOVED = 'friend_removed',
    FRIEND_VISITED = 'friend_visited',

    // 新手引导事件
    TUTORIAL_STEP_CHANGED = 'tutorial_step_changed',
    TUTORIAL_COMPLETED = 'tutorial_completed',

    // 动画事件
    ANIMATION_PLANT_BOUNCE = 'animation:plant_bounce',
    ANIMATION_GOLD_BOUNCE = 'animation:gold_bounce',
    ANIMATION_EXP_BOUNCE = 'animation:exp_bounce',

    // 性能事件
    PERFORMANCE_MODE_CHANGED = 'performance:mode_changed',
}

/**
 * 事件数据接口
 */
export interface EventData {
    event: GameEvent;
    data?: any;
    timestamp: number;
}

/**
 * 全局事件总线
 * 用于解耦游戏各组件之间的通信
 *
 * 例如收获系统只负责发送 CROP_HARVESTED，仓库、任务、成就和存档系统
 * 可以各自订阅该事件，无需让 Crop 直接引用所有下游模块。
 */
class EventBus {
    private _eventTarget: EventTarget = new EventTarget();
    private _eventHistory: EventData[] = [];
    private readonly _maxHistorySize: number = 100;
    
    /**
     * 发送事件
     */
    public emit(event: GameEvent, data?: any): void {
        const eventData: EventData = {
            event,
            data,
            timestamp: Date.now(),
        };
        
        // 触发事件
        this._eventTarget.emit(event, data);
        
        // 历史记录只服务于教学调试；发布环境不保存，避免每次事件产生额外数组操作。
        if (DEBUG) {
            this._eventHistory.push(eventData);
            if (this._eventHistory.length > this._maxHistorySize) {
                this._eventHistory.shift();
            }
            console.log(`[EventBus] ${event}`, data);
        }
    }
    
    /**
     * 监听事件
     */
    public on(event: GameEvent, callback: (data?: any) => void, target?: any): void {
        this._eventTarget.on(event, callback, target);
    }
    
    /**
     * 取消监听
     */
    public off(event: GameEvent, callback: (data?: any) => void, target?: any): void {
        this._eventTarget.off(event, callback, target);
    }
    
    /**
     * 一次性监听
     */
    public once(event: GameEvent, callback: (data?: any) => void, target?: any): void {
        this._eventTarget.once(event, callback, target);
    }
    
    /**
     * 获取事件历史
     */
    public getHistory(event?: GameEvent): EventData[] {
        if (event) {
            return this._eventHistory.filter(e => e.event === event);
        }
        return [...this._eventHistory];
    }
    
    /**
     * 清空事件历史
     */
    public clearHistory(): void {
        this._eventHistory = [];
    }
    
    /**
     * 移除所有监听器
     */
    public removeAllListeners(): void {
        // EventTarget 没有统一的 removeAll API，替换容器最直接也最不易漏掉事件。
        this._eventTarget = new EventTarget();
    }
}

// 导出单例实例
export const eventBus = new EventBus();
