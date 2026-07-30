import { _decorator, Component, EventTarget } from 'cc';
import { CurrencySystem } from './CurrencySystem';
import { ExpSystem } from './ExpSystem';
import { WarehouseManager } from './WarehouseManager';
import { ShopManager } from './ShopManager';
import { TaskManager } from './TaskManager';
import { AchievementManager } from './AchievementManager';
import { TimeSystem } from './TimeSystem';
import { WeatherSystem } from './WeatherSystem';
import { FriendsSystem } from './FriendsSystem';
import { TutorialManager } from './TutorialManager';
import { MarketOrderManager } from './MarketOrderManager';
import { eventBus, GameEvent } from './EventBus';
import { Soil } from './soil';
const { ccclass } = _decorator;

/**
 * 存档数据接口
 */
export interface SaveData {
    /** 存档版本 */
    version: string;
    /** 存档时间 */
    saveTime: number;
    /** 玩家名称 */
    playerName: string;
    /** 游戏天数 */
    gameDays: number;
    /** 游戏总时长（秒） */
    totalPlayTime: number;
}

/**
 * 存档管理器 - 管理游戏的存档和读档
 * 支持多存档、自动存档、云存档接口
 */
@ccclass('SaveManager')
export class SaveManager extends Component {
    private static _instance: SaveManager | null = null;

    /** 教程项目固定提供 3 个槽位，所有读写入口都通过同一规则校验。 */
    private readonly _slotCount = 3;
    
    /** 当前存档编号 */
    private _currentSlot: number = 0;
    
    /** 存档版本号 */
    private readonly _version: string = '1.0.0';
    
    /** 自动存档间隔（毫秒） */
    private _autoSaveInterval: number = 60000; // 1分钟
    
    /** 自动存档定时器 */
    private _autoSaveTimer: number = 0;
    
    /** 事件监听器 */
    private _eventTarget: EventTarget = new EventTarget();
    
    /** 是否正在存档 */
    private _isSaving: boolean = false;

    /** 事件触发的延迟存档状态，合并同一操作产生的多条事件 */
    private _saveScheduled: boolean = false;

    /**
     * 会改变持久数据的事件列表。
     * 注册与注销共用同一份配置，避免增加事件时只改到其中一处而造成监听泄漏。
     */
    private readonly _dirtyEvents: GameEvent[] = [
        GameEvent.CROP_HARVESTED,
        GameEvent.GOLD_CHANGED,
        GameEvent.LEVEL_UP,
        GameEvent.ACHIEVEMENT_UNLOCKED,
        GameEvent.SHOP_ITEM_BOUGHT,
        GameEvent.WAREHOUSE_CHANGED,
        GameEvent.MARKET_ORDER_COMPLETED,
    ];

    /** 内存中累计游戏时长，避免每帧写 localStorage */
    private _playTimeSeconds: number = 0;
    private _playTimeFlushElapsed: number = 0;
    
    public static getInstance(): SaveManager {
        if (!this._instance) {
            console.warn('[SaveManager] 实例不存在，请确保场景中已添加 SaveManager 组件');
        }
        return this._instance;
    }
    
    onLoad() {
        if (SaveManager._instance === null) {
            SaveManager._instance = this;
            this._playTimeSeconds = Number(localStorage.getItem('farm_total_playtime')) || 0;
            this._startAutoSave();
            this._registerEventListeners();
            console.log('[SaveManager] 初始化完成，已注册事件监听');
        } else {
            // SaveManager 节点是专用节点；出现重复实例时连同空壳节点一起清理。
            this.node.destroy();
        }
    }

    onDestroy() {
        if (SaveManager._instance === this) {
            this._unregisterEventListeners();
            this._stopAutoSave();
            this.unschedule(this._flushDirtySave);
            localStorage.setItem('farm_total_playtime', this._playTimeSeconds.toString());
            SaveManager._instance = null;
        }
    }

    // ==================== EventBus 事件监听 ====================

    /**
     * 注册事件监听 - 监听关键游戏事件标记脏数据
     */
    private _registerEventListeners(): void {
        for (const event of this._dirtyEvents) {
            eventBus.on(event, this._onDataChanged, this);
        }
    }

    /**
     * 取消事件监听
     */
    private _unregisterEventListeners(): void {
        for (const event of this._dirtyEvents) {
            eventBus.off(event, this._onDataChanged, this);
        }
    }

    /** 数据变更回调 - 标记需要存档 */
    private _onDataChanged(): void {
        if (this._saveScheduled) return;
        this._saveScheduled = true;
        this.scheduleOnce(this._flushDirtySave, 2);
    }

    /** 将短时间内的连续数据事件合并为一次写盘 */
    private _flushDirtySave(): void {
        this._saveScheduled = false;
        if (!this._isSaving) {
            void this.save();
        }
    }
    
    update(deltaTime: number) {
        // 更新游戏时长
        this._updatePlayTime(deltaTime);
    }
    
    /**
     * 获取存档列表信息
     */
    public getSaveList(): Array<SaveData | null> {
        const list: Array<SaveData | null> = [];
        for (let i = 0; i < this._slotCount; i++) {
            list.push(this.getSaveMeta(i));
        }
        return list;
    }

    /**
     * 获取单个存档槽位信息
     */
    public getSlotInfo(slot: number): SaveData | null {
        return this.getSaveMeta(slot);
    }

    // ==================== 存档操作 ====================
    
    /**
     * 保存游戏
     * @param slot 存档槽位（0-2）
     */
    public async save(slot: number = this._currentSlot): Promise<boolean> {
        if (!this._isValidSlot(slot)) return false;
        if (this._isSaving) {
            console.warn('[SaveManager] 正在存档中，请稍后');
            return false;
        }
        
        this._isSaving = true;
        this._eventTarget.emit('saveStart', { slot });
        
        try {
            const saveData = this._collectSaveData();
            const key = `farm_save_${slot}`;
            localStorage.setItem(key, JSON.stringify(saveData));
            
            // 保存存档元数据
            const metaData: SaveData = {
                version: this._version,
                saveTime: Date.now(),
                playerName: saveData.player?.name || '农场主',
                gameDays: saveData.gameDays || 0,
                totalPlayTime: saveData.totalPlayTime || 0,
            };
            localStorage.setItem(`${key}_meta`, JSON.stringify(metaData));
            
            this._currentSlot = slot;
            console.log(`[SaveManager] 存档已保存到槽位 ${slot}`);
            
            this._eventTarget.emit('saveComplete', { slot, success: true });
            eventBus.emit(GameEvent.GAME_SAVED, { slot, saveTime: metaData.saveTime });
            return true;
        } catch (e) {
            console.error('[SaveManager] 存档失败:', e);
            this._eventTarget.emit('saveComplete', { slot, success: false, error: e });
            return false;
        } finally {
            this._isSaving = false;
        }
    }
    
    /**
     * 加载游戏
     * @param slot 存档槽位（0-2）
     */
    public async load(slot: number = this._currentSlot): Promise<boolean> {
        if (!this._isValidSlot(slot)) return false;
        try {
            const key = `farm_save_${slot}`;
            const dataStr = localStorage.getItem(key);
            
            if (!dataStr) {
                console.warn(`[SaveManager] 槽位 ${slot} 没有存档数据`);
                return false;
            }
            
            const saveData = JSON.parse(dataStr);
            
            // 版本检查
            if (saveData.version !== this._version) {
                console.warn(`[SaveManager] 存档版本不匹配: ${saveData.version} vs ${this._version}`);
                // 尝试迁移
                if (!this._migrateSaveData(saveData)) {
                    return false;
                }
            }
            
            this._applySaveData(saveData);
            this._currentSlot = slot;
            
            console.log(`[SaveManager] 已从槽位 ${slot} 加载存档`);
            this._eventTarget.emit('loadComplete', { slot, success: true });
            eventBus.emit(GameEvent.GAME_LOADED, { slot });
            return true;
        } catch (e) {
            console.error('[SaveManager] 读档失败:', e);
            this._eventTarget.emit('loadComplete', { slot, success: false, error: e });
            return false;
        }
    }
    
    /**
     * 检查存档是否存在
     */
    public hasSave(slot: number): boolean {
        if (!this._isValidSlot(slot, false)) return false;
        return localStorage.getItem(`farm_save_${slot}`) !== null;
    }
    
    /**
     * 获取存档元数据
     */
    public getSaveMeta(slot: number): SaveData | null {
        if (!this._isValidSlot(slot, false)) return null;
        const metaStr = localStorage.getItem(`farm_save_${slot}_meta`);
        if (metaStr) {
            try {
                return JSON.parse(metaStr);
            } catch (e) {
                console.error('[SaveManager] 解析存档元数据失败:', e);
            }
        }
        return null;
    }
    
    /**
     * 删除存档
     */
    public deleteSave(slot: number): boolean {
        if (!this._isValidSlot(slot)) return false;
        if (!this.hasSave(slot)) {
            console.warn(`[SaveManager] 槽位 ${slot} 没有存档`);
            return false;
        }
        
        localStorage.removeItem(`farm_save_${slot}`);
        localStorage.removeItem(`farm_save_${slot}_meta`);
        console.log(`[SaveManager] 已删除槽位 ${slot} 的存档`);
        return true;
    }
    
    /**
     * 获取所有存档槽位信息
     */
    public getAllSaveSlots(): { slot: number; hasData: boolean; meta: SaveData | null }[] {
        const slots = [];
        for (let i = 0; i < this._slotCount; i++) {
            slots.push({
                slot: i,
                hasData: this.hasSave(i),
                meta: this.getSaveMeta(i),
            });
        }
        return slots;
    }
    
    /**
     * 获取当前存档槽位
     */
    public getCurrentSlot(): number {
        return this._currentSlot;
    }
    
    /**
     * 导出存档为字符串
     */
    public exportSave(slot: number = this._currentSlot): string | null {
        if (!this._isValidSlot(slot)) return null;
        const key = `farm_save_${slot}`;
        const dataStr = localStorage.getItem(key);
        if (!dataStr) return null;
        
        // 简单的Base64编码
        try {
            return btoa(encodeURIComponent(dataStr));
        } catch (e) {
            console.error('[SaveManager] 导出存档失败:', e);
            return null;
        }
    }
    
    /**
     * 导入存档
     */
    public importSave(slot: number, exportStr: string): boolean {
        if (!this._isValidSlot(slot)) return false;
        try {
            const dataStr = decodeURIComponent(atob(exportStr));
            const data = JSON.parse(dataStr);
            
            const key = `farm_save_${slot}`;
            localStorage.setItem(key, JSON.stringify(data));
            
            // 更新元数据
            const metaData: SaveData = {
                version: data.version,
                saveTime: Date.now(),
                playerName: data.player?.name || '农场主',
                gameDays: data.gameDays || 0,
                totalPlayTime: data.totalPlayTime || 0,
            };
            localStorage.setItem(`${key}_meta`, JSON.stringify(metaData));
            
            console.log(`[SaveManager] 已导入存档到槽位 ${slot}`);
            return true;
        } catch (e) {
            console.error('[SaveManager] 导入存档失败:', e);
            return false;
        }
    }
    
    // ==================== 自动存档 ====================
    
    /**
     * 设置自动存档间隔
     */
    public setAutoSaveInterval(intervalMs: number): void {
        if (!Number.isFinite(intervalMs) || intervalMs < 5000) {
            console.warn('[SaveManager] 自动存档间隔不能小于 5 秒');
            return;
        }
        this._autoSaveInterval = intervalMs;
        this._stopAutoSave();
        this._startAutoSave();
    }
    
    /**
     * 启用/禁用自动存档
     */
    public setAutoSaveEnabled(enabled: boolean): void {
        if (enabled) {
            this._startAutoSave();
        } else {
            this._stopAutoSave();
        }
    }
    
    // ==================== 事件监听 ====================
    
    public on(event: string, callback: (...args: any[]) => void, target?: any): void {
        this._eventTarget.on(event, callback, target);
    }
    
    public off(event: string, callback: (...args: any[]) => void, target?: any): void {
        this._eventTarget.off(event, callback, target);
    }
    
    // ==================== 私有方法 ====================
    
    /**
     * 收集存档数据
     */
    private _collectSaveData(): any {
        const data: any = {
            version: this._version,
            saveTime: Date.now(),
            totalPlayTime: this._getTotalPlayTime(),
            gameDays: this._getGameDays(),
        };
        
        // 收集货币系统数据
        const currency = CurrencySystem.getInstance();
        if (currency) {
            data.currency = {
                gold: currency.gold,
                diamond: currency.diamond,
            };
        }
        
        // 收集经验系统数据
        const expSystem = ExpSystem.getInstance();
        if (expSystem) {
            data.player = expSystem.getPlayerData();
        }
        
        // 收集仓库系统数据
        const warehouse = WarehouseManager.getInstance();
        if (warehouse) {
            data.warehouse = {
                items: warehouse.getAllItems(),
                totalValue: warehouse.getTotalValue(),
            };
        }

        const shopManager = ShopManager.getInstance();
        if (shopManager) {
            data.shop = shopManager.getSaveData();
        }

        const marketOrderManager = MarketOrderManager.getInstance();
        if (marketOrderManager) {
            data.marketOrders = marketOrderManager.getSaveData();
        }
        
        // 收集任务系统数据
        const taskManager = TaskManager.getInstance();
        if (taskManager) {
            data.tasks = {
                all: taskManager.getAllTasks(),
                daily: taskManager.getDailyTasks(),
            };
        }
        
        // 收集成就系统数据
        const achievementManager = AchievementManager.getInstance();
        if (achievementManager) {
            data.achievements = {
                all: achievementManager.getAllAchievements(),
                stats: achievementManager.getAchievementStats(),
            };
        }

        // 收集农田作物数据
        const soil = this.node.scene.getComponentInChildren(Soil);
        if (soil) {
            data.crops = soil.getCropsSaveData();
            data.extendBrand = soil.getExtendBrandSaveData();
        }

        // 收集时间系统数据
        const timeSystem = TimeSystem.getInstance();
        if (timeSystem) {
            data.time = timeSystem.getSaveData();
        }

        // 收集天气系统数据
        const weatherSystem = WeatherSystem.getInstance();
        if (weatherSystem) {
            data.weather = weatherSystem.getSaveData();
        }

        // 收集好友系统数据
        const friendsSystem = FriendsSystem.getInstance();
        if (friendsSystem) {
            data.friends = friendsSystem.getSaveData();
        }

        // 收集新手引导数据
        const tutorialManager = TutorialManager.getInstance();
        if (tutorialManager) {
            data.tutorial = tutorialManager.getSaveData();
        }

        // 收集设置
        const settings = localStorage.getItem('farm_settings');
        if (settings) {
            // 设置不是核心存档数据；即使它被手工改坏，也不应导致整个存档失败。
            try {
                data.settings = JSON.parse(settings);
            } catch (error) {
                console.warn('[SaveManager] 设置数据格式无效，本次存档将忽略设置:', error);
            }
        }
        
        return data;
    }
    
    /**
     * 应用存档数据 - 恢复所有系统状态
     */
    private _applySaveData(data: any): void {
        // 恢复货币系统
        if (data.currency) {
            const currency = CurrencySystem.getInstance();
            if (currency) {
                currency.setGold(data.currency.gold || 0);
            }
        }
        
        // 恢复经验系统
        if (data.player) {
            const expSystem = ExpSystem.getInstance();
            if (expSystem) {
                expSystem.setPlayerData(data.player);
            }
        }
        
        // 恢复仓库系统
        if (data.warehouse && data.warehouse.items) {
            const warehouse = WarehouseManager.getInstance();
            if (warehouse) {
                warehouse.setItems(data.warehouse.items);
            }
        }

        if (data.shop) {
            const shopManager = ShopManager.getInstance();
            if (shopManager) {
                shopManager.restoreFromSave(data.shop);
            }
        }

        if (data.marketOrders) {
            const marketOrderManager = MarketOrderManager.getInstance();
            if (marketOrderManager) {
                marketOrderManager.restoreFromSave(data.marketOrders);
            }
        }
        
        // 恢复任务系统
        if (data.tasks) {
            const taskManager = TaskManager.getInstance();
            if (taskManager) {
                taskManager.loadSaveData(data.tasks);
            }
        }
        
        // 恢复成就系统
        if (data.achievements) {
            const achievementManager = AchievementManager.getInstance();
            if (achievementManager) {
                achievementManager.loadSaveData(data.achievements);
            }
        }

        // 恢复农田作物
        if (data.crops && Array.isArray(data.crops)) {
            const soil = this.node.scene.getComponentInChildren(Soil);
            if (soil) {
                soil.restoreCropsFromSave(data.crops);
            }
        }

        // 恢复扩建牌位置
        if (data.extendBrand) {
            const soil = this.node.scene.getComponentInChildren(Soil);
            if (soil) {
                soil.restoreExtendBrandFromSave(data.extendBrand);
            }
        }

        // 恢复时间系统
        if (data.time) {
            const timeSystem = TimeSystem.getInstance();
            if (timeSystem) {
                timeSystem.restoreFromSave(data.time);
            }
        }

        // 恢复天气系统
        if (data.weather) {
            const weatherSystem = WeatherSystem.getInstance();
            if (weatherSystem) {
                weatherSystem.restoreFromSave(data.weather);
            }
        }

        // 恢复好友系统
        if (data.friends) {
            const friendsSystem = FriendsSystem.getInstance();
            if (friendsSystem) {
                friendsSystem.restoreFromSave(data.friends);
            }
        }

        // 恢复新手引导
        if (data.tutorial) {
            const tutorialManager = TutorialManager.getInstance();
            if (tutorialManager) {
                tutorialManager.restoreFromSave(data.tutorial);
            }
        }

        // 恢复设置
        if (data.settings) {
            localStorage.setItem('farm_settings', JSON.stringify(data.settings));
        }
    }
    
    /**
     * 存档数据迁移
     */
    private _migrateSaveData(data: any): boolean {
        if (!data.version) {
            data.version = '1.0.0';
        }
        console.log('[SaveManager] 存档数据已迁移到最新版本');
        return true;
    }

    /**
     * 校验槽位，防止外部参数意外写入 farm_save_-1 等无效键。
     * 查询类调用可以关闭日志，避免 UI 枚举槽位时产生无意义告警。
     */
    private _isValidSlot(slot: number, logWarning = true): boolean {
        const valid = Number.isInteger(slot) && slot >= 0 && slot < this._slotCount;
        if (!valid && logWarning) {
            console.warn(`[SaveManager] 无效存档槽位: ${slot}`);
        }
        return valid;
    }
    
    /**
     * 获取总游戏时长（秒）
     */
    private _getTotalPlayTime(): number {
        return Math.floor(this._playTimeSeconds);
    }
    
    /**
     * 获取游戏天数
     */
    private _getGameDays(): number {
        return parseInt(localStorage.getItem('farm_game_days') || '1');
    }
    
    /**
     * 更新游戏时长
     */
    private _updatePlayTime(deltaTime: number): void {
        this._playTimeSeconds += deltaTime;
        this._playTimeFlushElapsed += deltaTime;
        if (this._playTimeFlushElapsed >= 5) {
            this._playTimeFlushElapsed = 0;
            localStorage.setItem('farm_total_playtime', this._playTimeSeconds.toString());
        }
    }
    
    /**
     * 开始自动存档
     */
    private _startAutoSave(): void {
        this._stopAutoSave();
        this._autoSaveTimer = window.setInterval(() => {
            this.save();
        }, this._autoSaveInterval);
        console.log('[SaveManager] 自动存档已启用');
    }
    
    /**
     * 停止自动存档
     */
    private _stopAutoSave(): void {
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = 0;
        }
    }
}
