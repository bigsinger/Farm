import { _decorator, Component, EventTarget } from 'cc';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/**
 * 成就类型枚举
 */
export enum AchievementType {
    /** 种植成就 */
    Plant = 1,
    /** 收获成就 */
    Harvest = 2,
    /** 销售成就 */
    Sell = 3,
    /** 扩建成就 */
    Extend = 4,
    /** 登录成就 */
    Login = 5,
    /** 经验成就 */
    Exp = 6,
    /** 金币成就 */
    Gold = 7,
    /** 特殊成就 */
    Special = 99,
}

/**
 * 成就等级
 */
export enum AchievementLevel {
    Bronze = 1,   // 青铜
    Silver = 2,   // 白银
    Gold = 3,     // 黄金
    Platinum = 4, // 白金
    Diamond = 5,  // 钻石
}

/**
 * 成就数据接口
 */
export interface AchievementData {
    /** 成就ID */
    id: string;
    /** 成就类型 */
    type: AchievementType;
    /** 成就等级 */
    level: AchievementLevel;
    /** 成就名称 */
    name: string;
    /** 成就描述 */
    description: string;
    /** 完成条件目标值 */
    targetValue: number;
    /** 当前进度 */
    currentValue: number;
    /** 是否已完成 */
    isCompleted: boolean;
    /** 完成时间 */
    completeTime?: number;
    /** 奖励金币 */
    rewardGold: number;
    /** 奖励经验 */
    rewardExp: number;
    /** 图标路径 */
    icon: string;
}

/**
 * 成就管理器 - 管理游戏中的成就系统
 * 支持多级成就、进度追踪、奖励领取
 */
@ccclass('AchievementManager')
export class AchievementManager extends Component {
    private static _instance: AchievementManager = null;
    
    /** 成就列表 */
    private _achievements: Map<string, AchievementData> = new Map();
    
    /** 已解锁成就ID列表 */
    private _unlockedAchievements: string[] = [];
    
    /** 事件监听器 */
    private _eventTarget: EventTarget = new EventTarget();
    
    /** 成就统计 */
    private _stats: Map<AchievementType, number> = new Map();
    
    public static getInstance(): AchievementManager {
        if (!this._instance) {
            console.warn('[AchievementManager] 实例不存在，请确保场景中已添加 AchievementManager 组件');
        }
        return this._instance;
    }
    
    onLoad() {
        if (AchievementManager._instance === null) {
            AchievementManager._instance = this;
            this._initAchievements();
            this._loadData();
            this._registerEventListeners();
            console.log('[AchievementManager] 初始化完成，已注册事件监听');
        } else {
            this.destroy();
        }
    }

    onDestroy() {
        if (AchievementManager._instance === this) {
            this._unregisterEventListeners();
            this._flushSave();  // 销毁前强制刷新脏数据
            AchievementManager._instance = null;
        }
    }

    /** 数据脏标记（避免高频写入localStorage） */
    private _dirty: boolean = false;

    // ==================== EventBus 事件监听 ====================

    /**
     * 注册事件监听 - 监听游戏事件以自动更新成就进度
     */
    private _registerEventListeners(): void {
        eventBus.on(GameEvent.CROP_PLANTED, this._onCropPlanted, this);
        eventBus.on(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.on(GameEvent.WAREHOUSE_SOLD, this._onWarehouseSold, this);
        eventBus.on(GameEvent.GOLD_CHANGED, this._onGoldChanged, this);
        eventBus.on(GameEvent.EXP_GAINED, this._onExpGained, this);
        eventBus.on(GameEvent.LEVEL_UP, this._onLevelUp, this);
    }

    /**
     * 取消事件监听
     */
    private _unregisterEventListeners(): void {
        eventBus.off(GameEvent.CROP_PLANTED, this._onCropPlanted, this);
        eventBus.off(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.off(GameEvent.WAREHOUSE_SOLD, this._onWarehouseSold, this);
        eventBus.off(GameEvent.GOLD_CHANGED, this._onGoldChanged, this);
        eventBus.off(GameEvent.EXP_GAINED, this._onExpGained, this);
        eventBus.off(GameEvent.LEVEL_UP, this._onLevelUp, this);
    }

    /** 种植事件 - 更新种植成就 */
    private _onCropPlanted(data: any): void {
        this.updateProgress(AchievementType.Plant, 1);
    }

    /** 收获事件 - 更新收获成就 */
    private _onCropHarvested(data: any): void {
        this.updateProgress(AchievementType.Harvest, 1);
    }

    /** 出售事件 - 更新销售成就 */
    private _onWarehouseSold(data: any): void {
        const count = data?.count || 1;
        this.updateProgress(AchievementType.Sell, count);
    }

    /** 金币变化事件 - 更新金币成就（累计金币） */
    private _onGoldChanged(data: any): void {
        if (data?.total !== undefined) {
            this.setProgress(AchievementType.Gold, data.total);
        }
    }

    /** 经验获得事件 - 更新经验成就（累计经验） */
    private _onExpGained(data: any): void {
        if (data?.totalExp !== undefined) {
            this.setProgress(AchievementType.Exp, data.totalExp);
        }
    }

    /** 升级事件 - 记录等级里程碑 */
    private _onLevelUp(data: any): void {
        console.log(`[AchievementManager] 玩家升级到 ${data?.level} 级`);
    }
    
    // ==================== 成就操作 ====================
    
    /**
     * 更新成就进度
     * @param type 成就类型
     * @param value 增加的值
     */
    public updateProgress(type: AchievementType, value: number = 1): void {
        // 更新统计
        const currentStat = this._stats.get(type) || 0;
        this._stats.set(type, currentStat + value);
        
        // 检查所有未完成的成就
        for (const achievement of this._achievements.values()) {
            if (!achievement.isCompleted && achievement.type === type) {
                achievement.currentValue = this._stats.get(type) || 0;
                
                if (achievement.currentValue >= achievement.targetValue) {
                    this._unlockAchievement(achievement);
                }
            }
        }
        
        this._markDirty();
    }
    
    /**
     * 设置成就进度（直接设置绝对值）
     */
    public setProgress(type: AchievementType, value: number): void {
        this._stats.set(type, value);
        
        for (const achievement of this._achievements.values()) {
            if (!achievement.isCompleted && achievement.type === type) {
                achievement.currentValue = value;
                
                if (achievement.currentValue >= achievement.targetValue) {
                    this._unlockAchievement(achievement);
                }
            }
        }
        
        this._markDirty();
    }
    
    /**
     * 获取成就进度
     */
    public getProgress(type: AchievementType): number {
        return this._stats.get(type) || 0;
    }
    
    /**
     * 获取所有成就
     */
    public getAllAchievements(): AchievementData[] {
        return Array.from(this._achievements.values());
    }
    
    /**
     * 获取已完成的成就
     */
    public getCompletedAchievements(): AchievementData[] {
        return this.getAllAchievements().filter(a => a.isCompleted);
    }
    
    /**
     * 获取未完成的成就
     */
    public getIncompleteAchievements(): AchievementData[] {
        return this.getAllAchievements().filter(a => !a.isCompleted);
    }
    
    /**
     * 按类型获取成就
     */
    public getAchievementsByType(type: AchievementType): AchievementData[] {
        return this.getAllAchievements().filter(a => a.type === type);
    }
    
    /**
     * 获取成就统计
     */
    public getAchievementStats(): {
        total: number;
        completed: number;
        completionRate: number;
        totalRewardGold: number;
        totalRewardExp: number;
    } {
        const all = this.getAllAchievements();
        const completed = all.filter(a => a.isCompleted);
        const totalRewardGold = completed.reduce((sum, a) => sum + a.rewardGold, 0);
        const totalRewardExp = completed.reduce((sum, a) => sum + a.rewardExp, 0);
        
        return {
            total: all.length,
            completed: completed.length,
            completionRate: all.length > 0 ? completed.length / all.length : 0,
            totalRewardGold,
            totalRewardExp,
        };
    }
    
    /**
     * 获取最近完成的成就
     */
    public getRecentAchievements(count: number = 5): AchievementData[] {
        return this.getCompletedAchievements()
            .filter(a => a.completeTime)
            .sort((a, b) => (b.completeTime || 0) - (a.completeTime || 0))
            .slice(0, count);
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
     * 标记脏数据 — 延迟2秒合并写入localStorage
     * 避免高频事件（连续收获/种植）导致的同步阻塞
     */
    private _markDirty(): void {
        if (!this._dirty) {
            this._dirty = true;
            this.scheduleOnce(() => this._flushSave(), 2.0);
        }
    }
    
    /** 立即写入（onDestroy/loadSaveData时使用） */
    private _flushSave(): void {
        this._dirty = false;
        this._saveData();
    }

    /**
     * 解锁成就
     */
    private _unlockAchievement(achievement: AchievementData): void {
        if (achievement.isCompleted) return;

        achievement.isCompleted = true;
        achievement.completeTime = Date.now();
        this._unlockedAchievements.push(achievement.id);

        console.log(`[AchievementManager] 解锁成就: ${achievement.name} (${achievement.description})`);

        this._eventTarget.emit('achievementUnlocked', achievement);
        eventBus.emit(GameEvent.ACHIEVEMENT_UNLOCKED, {
            achievementId: achievement.id,
            name: achievement.name,
            description: achievement.description,
            rewardGold: achievement.rewardGold,
            rewardExp: achievement.rewardExp,
        });
    }
    
    /**
     * 初始化成就列表
     */
    private _initAchievements(): void {
        // 种植成就
        this._addAchievement('plant_1', AchievementType.Plant, AchievementLevel.Bronze, '初出茅庐', '种植10个作物', 10, 50, 20, 'achievement/plant_bronze');
        this._addAchievement('plant_2', AchievementType.Plant, AchievementLevel.Silver, '耕耘者', '种植100个作物', 100, 150, 50, 'achievement/plant_silver');
        this._addAchievement('plant_3', AchievementType.Plant, AchievementLevel.Gold, '种植大师', '种植1000个作物', 1000, 500, 150, 'achievement/plant_gold');
        this._addAchievement('plant_4', AchievementType.Plant, AchievementLevel.Platinum, '农业巨匠', '种植5000个作物', 5000, 2000, 500, 'achievement/plant_platinum');
        this._addAchievement('plant_5', AchievementType.Plant, AchievementLevel.Diamond, '传奇农场主', '种植10000个作物', 10000, 5000, 1000, 'achievement/plant_diamond');
        
        // 收获成就
        this._addAchievement('harvest_1', AchievementType.Harvest, AchievementLevel.Bronze, '首次收获', '收获5个作物', 5, 50, 20, 'achievement/harvest_bronze');
        this._addAchievement('harvest_2', AchievementType.Harvest, AchievementLevel.Silver, '丰收季', '收获50个作物', 50, 150, 50, 'achievement/harvest_silver');
        this._addAchievement('harvest_3', AchievementType.Harvest, AchievementLevel.Gold, '丰收大师', '收获500个作物', 500, 500, 150, 'achievement/harvest_gold');
        this._addAchievement('harvest_4', AchievementType.Harvest, AchievementLevel.Platinum, '丰收巨匠', '收获2500个作物', 2500, 2000, 500, 'achievement/harvest_platinum');
        this._addAchievement('harvest_5', AchievementType.Harvest, AchievementLevel.Diamond, '传奇收获者', '收获5000个作物', 5000, 5000, 1000, 'achievement/harvest_diamond');
        
        // 销售成就
        this._addAchievement('sell_1', AchievementType.Sell, AchievementLevel.Bronze, '首次销售', '销售5个作物', 5, 50, 20, 'achievement/sell_bronze');
        this._addAchievement('sell_2', AchievementType.Sell, AchievementLevel.Silver, '小商人', '销售50个作物', 50, 150, 50, 'achievement/sell_silver');
        this._addAchievement('sell_3', AchievementType.Sell, AchievementLevel.Gold, '商业大亨', '销售500个作物', 500, 500, 150, 'achievement/sell_gold');
        this._addAchievement('sell_4', AchievementType.Sell, AchievementLevel.Platinum, '市场巨头', '销售2500个作物', 2500, 2000, 500, 'achievement/sell_platinum');
        this._addAchievement('sell_5', AchievementType.Sell, AchievementLevel.Diamond, '传奇商人', '销售5000个作物', 5000, 5000, 1000, 'achievement/sell_diamond');
        
        // 扩建成就
        this._addAchievement('extend_1', AchievementType.Extend, AchievementLevel.Bronze, '扩大农场', '扩建5块土地', 5, 100, 30, 'achievement/extend_bronze');
        this._addAchievement('extend_2', AchievementType.Extend, AchievementLevel.Silver, '农场主', '扩建20块土地', 20, 300, 80, 'achievement/extend_silver');
        this._addAchievement('extend_3', AchievementType.Extend, AchievementLevel.Gold, '大农场主', '扩建50块土地', 50, 1000, 200, 'achievement/extend_gold');
        
        // 登录成就
        this._addAchievement('login_1', AchievementType.Login, AchievementLevel.Bronze, '初来乍到', '累计登录3天', 3, 100, 20, 'achievement/login_bronze');
        this._addAchievement('login_2', AchievementType.Login, AchievementLevel.Silver, '常驻玩家', '累计登录7天', 7, 200, 50, 'achievement/login_silver');
        this._addAchievement('login_3', AchievementType.Login, AchievementLevel.Gold, '忠实玩家', '累计登录30天', 30, 1000, 200, 'achievement/login_gold');
        
        // 金币成就
        this._addAchievement('gold_1', AchievementType.Gold, AchievementLevel.Bronze, '小康之家', '累计获得1000金币', 1000, 100, 30, 'achievement/gold_bronze');
        this._addAchievement('gold_2', AchievementType.Gold, AchievementLevel.Silver, '富足之家', '累计获得10000金币', 10000, 300, 80, 'achievement/gold_silver');
        this._addAchievement('gold_3', AchievementType.Gold, AchievementLevel.Gold, '豪门大户', '累计获得100000金币', 100000, 1000, 200, 'achievement/gold_gold');
        
        // 经验成就
        this._addAchievement('exp_1', AchievementType.Exp, AchievementLevel.Bronze, '初学者', '累计获得1000经验', 1000, 100, 30, 'achievement/exp_bronze');
        this._addAchievement('exp_2', AchievementType.Exp, AchievementLevel.Silver, '进阶者', '累计获得10000经验', 10000, 300, 80, 'achievement/exp_silver');
        this._addAchievement('exp_3', AchievementType.Exp, AchievementLevel.Gold, '经验丰富', '累计获得100000经验', 100000, 1000, 200, 'achievement/exp_gold');
        
        // 特殊成就
        this._addAchievement('special_1', AchievementType.Special, AchievementLevel.Gold, '开荒者', '完成所有新手任务', 1, 500, 100, 'achievement/special_pioneer');
        this._addAchievement('special_2', AchievementType.Special, AchievementLevel.Platinum, '收藏家', '收集所有种类的作物', 15, 2000, 500, 'achievement/special_collector');
    }
    
    /**
     * 添加成就
     */
    private _addAchievement(
        id: string,
        type: AchievementType,
        level: AchievementLevel,
        name: string,
        description: string,
        targetValue: number,
        rewardGold: number,
        rewardExp: number,
        icon: string
    ): void {
        const achievement: AchievementData = {
            id,
            type,
            level,
            name,
            description,
            targetValue,
            currentValue: 0,
            isCompleted: false,
            rewardGold,
            rewardExp,
            icon,
        };
        this._achievements.set(id, achievement);
    }
    
    /**
     * 保存数据
     */
    private _saveData(): void {
        const data = {
            achievements: Array.from(this._achievements.values()),
            stats: Array.from(this._stats.entries()),
            unlocked: this._unlockedAchievements,
        };
        localStorage.setItem('farm_achievements', JSON.stringify(data));
    }
    
    /**
     * 加载数据
     */
    private _loadData(): void {
        const dataStr = localStorage.getItem('farm_achievements');
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                
                // 加载成就进度
                if (data.achievements) {
                    for (const ach of data.achievements) {
                        if (this._achievements.has(ach.id)) {
                            const existing = this._achievements.get(ach.id);
                            existing.currentValue = ach.currentValue;
                            existing.isCompleted = ach.isCompleted;
                            existing.completeTime = ach.completeTime;
                        }
                    }
                }
                
                // 加载统计
                if (data.stats) {
                    for (const [type, value] of data.stats) {
                        this._stats.set(type, value);
                    }
                }
                
                // 加载已解锁列表
                if (data.unlocked) {
                    this._unlockedAchievements = data.unlocked;
                }
                
                console.log(`[AchievementManager] 加载数据完成: ${this.getCompletedAchievements().length}/${this._achievements.size} 个成就`);
            } catch (e) {
                console.error('[AchievementManager] 加载数据失败:', e);
            }
        }
    }

    /**
     * 从存档数据恢复（供SaveManager调用）
     */
    public loadSaveData(data: any): void {
        if (!data) return;

        // 恢复成就数据
        if (data.all && Array.isArray(data.all)) {
            for (const ach of data.all) {
                if (this._achievements.has(ach.id)) {
                    const existing = this._achievements.get(ach.id);
                    existing.currentValue = ach.currentValue || 0;
                    existing.isCompleted = ach.isCompleted || false;
                    existing.completeTime = ach.completeTime || 0;
                }
            }
        }

        // 恢复统计
        if (data.stats) {
            if (Array.isArray(data.stats)) {
                for (const [type, value] of data.stats) {
                    this._stats.set(type, value);
                }
            } else if (typeof data.stats === 'object') {
                for (const [type, value] of Object.entries(data.stats)) {
                    this._stats.set(type as any, value as number);
                }
            }
        }

        this._saveData();
        console.log('[AchievementManager] 从存档恢复数据完成');
    }
}
