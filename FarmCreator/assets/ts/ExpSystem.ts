import { _decorator, Component, EventTarget } from 'cc';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/**
 * 等级配置接口
 */
export interface LevelConfig {
    /** 等级 */
    level: number;
    /** 升级所需经验 */
    requiredExp: number;
    /** 解锁的作物ID列表 */
    unlockCrops: number[];
    /** 解锁的功能 */
    unlockFeatures: string[];
    /** 等级奖励金币 */
    rewardGold: number;
}

/**
 * 玩家数据接口
 */
export interface PlayerData {
    /** 当前等级 */
    level: number;
    /** 当前经验 */
    currentExp: number;
    /** 总获得经验 */
    totalExp: number;
    /** 升级所需经验 */
    expToNextLevel: number;
}

/**
 * 经验系统 - 管理玩家等级和经验值
 * 支持经验获取、等级升级、解锁功能
 */
@ccclass('ExpSystem')
export class ExpSystem extends Component {
    private static _instance: ExpSystem = null;
    
    /** 玩家数据 */
    private _playerData: PlayerData = {
        level: 1,
        currentExp: 0,
        totalExp: 0,
        expToNextLevel: 100,
    };
    
    /** 事件监听器 */
    private _eventTarget: EventTarget = new EventTarget();
    
    /** 等级配置表 - 前50级 */
    private _levelConfigs: LevelConfig[] = [];
    
    public static getInstance(): ExpSystem {
        if (!this._instance) {
            console.warn('[ExpSystem] 实例不存在，请确保场景中已添加 ExpSystem 组件');
        }
        return this._instance;
    }
    
    onLoad() {
        if (ExpSystem._instance === null) {
            ExpSystem._instance = this;
            this._initLevelConfigs();
            this._loadData();
            this._registerEventListeners();
            console.log('[ExpSystem] 初始化完成，已注册事件监听');
        } else {
            this.destroy();
        }
    }

    onDestroy() {
        if (ExpSystem._instance === this) {
            this._unregisterEventListeners();
            this._flushSave();
            ExpSystem._instance = null;
        }
    }

    /** 数据脏标记（避免高频写入localStorage） */
    private _dirty: boolean = false;

    // ==================== EventBus 事件监听 ====================

    /**
     * 注册事件监听 - 监听游戏事件以自动获取经验
     */
    private _registerEventListeners(): void {
        eventBus.on(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.on(GameEvent.TASK_REWARD_CLAIMED, this._onTaskRewardClaimed, this);
        eventBus.on(GameEvent.ACHIEVEMENT_UNLOCKED, this._onAchievementUnlocked, this);
    }

    /**
     * 取消事件监听
     */
    private _unregisterEventListeners(): void {
        eventBus.off(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.off(GameEvent.TASK_REWARD_CLAIMED, this._onTaskRewardClaimed, this);
        eventBus.off(GameEvent.ACHIEVEMENT_UNLOCKED, this._onAchievementUnlocked, this);
    }

    /** 收获作物 - 获得基础经验 */
    private _onCropHarvested(data: any): void {
        // 收获作物获得5点基础经验
        const baseExp = 5;
        this.gainExp(baseExp, `收获${data?.cropName || '作物'}`);
    }

    /** 任务奖励领取 - 获得任务经验奖励 */
    private _onTaskRewardClaimed(data: any): void {
        if (data?.exp && data.exp > 0) {
            this.gainExp(data.exp, `任务奖励: ${data?.title || ''}`);
        }
    }

    /** 成就解锁 - 获得成就经验奖励 */
    private _onAchievementUnlocked(data: any): void {
        if (data?.rewardExp && data.rewardExp > 0) {
            this.gainExp(data.rewardExp, `成就奖励: ${data?.name || ''}`);
        }
    }
    
    // ==================== 经验操作 ====================
    
    /**
     * 获取经验
     * @param amount 经验数量
     * @param reason 获取原因
     */
    public gainExp(amount: number, reason: string = ''): void {
        if (amount <= 0) return;
        
        this._playerData.currentExp += amount;
        this._playerData.totalExp += amount;
        
        console.log(`[ExpSystem] 获得 ${amount} 经验${reason ? ' (' + reason + ')' : ''}`);
        
        // 检查是否升级
        while (this._playerData.currentExp >= this._playerData.expToNextLevel) {
            this._levelUp();
        }
        
        this._markDirty();
        this._eventTarget.emit('expGained', { amount, current: this._playerData.currentExp, total: this._playerData.totalExp });
        eventBus.emit(GameEvent.EXP_GAINED, { amount, current: this._playerData.currentExp, totalExp: this._playerData.totalExp, level: this._playerData.level });
    }

    /**
     * 设置玩家数据（用于存档恢复）
     */
    public setPlayerData(data: PlayerData): void {
        this._playerData = { ...data };
        this._saveData();
        this._eventTarget.emit('expGained', { amount: 0, current: this._playerData.currentExp, total: this._playerData.totalExp });
        eventBus.emit(GameEvent.EXP_GAINED, { amount: 0, current: this._playerData.currentExp, totalExp: this._playerData.totalExp, level: this._playerData.level });
        console.log(`[ExpSystem] 恢复玩家数据: 等级${this._playerData.level}, 经验${this._playerData.currentExp}`);
    }
    
    /**
     * 获取当前等级
     */
    public getLevel(): number {
        return this._playerData.level;
    }
    
    /**
     * 获取当前经验
     */
    public getCurrentExp(): number {
        return this._playerData.currentExp;
    }
    
    /**
     * 获取升级所需经验
     */
    public getExpToNextLevel(): number {
        return this._playerData.expToNextLevel;
    }
    
    /**
     * 获取经验进度百分比
     */
    public getExpProgress(): number {
        return this._playerData.currentExp / this._playerData.expToNextLevel;
    }
    
    /**
     * 获取玩家完整数据
     */
    public getPlayerData(): PlayerData {
        return { ...this._playerData };
    }
    
    /**
     * 检查是否已解锁某功能
     */
    public isFeatureUnlocked(feature: string): boolean {
        const config = this._levelConfigs.find(c => c.level === this._playerData.level);
        if (!config) return false;
        return config.unlockFeatures.includes(feature);
    }
    
    /**
     * 检查是否已解锁某作物
     */
    public isCropUnlocked(cropId: number): boolean {
        for (let i = 0; i <= this._playerData.level; i++) {
            const config = this._levelConfigs.find(c => c.level === i);
            if (config && config.unlockCrops.includes(cropId)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 获取当前等级解锁的作物
     */
    public getUnlockedCrops(): number[] {
        const crops: number[] = [];
        for (let i = 1; i <= this._playerData.level; i++) {
            const config = this._levelConfigs.find(c => c.level === i);
            if (config) {
                crops.push(...config.unlockCrops);
            }
        }
        return crops;
    }
    
    /**
     * 获取等级配置
     */
    public getLevelConfig(level: number): LevelConfig | null {
        return this._levelConfigs.find(c => c.level === level) || null;
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
     * 避免高频事件（连续收获经验）导致的同步阻塞
     */
    private _markDirty(): void {
        if (!this._dirty) {
            this._dirty = true;
            this.scheduleOnce(() => this._flushSave(), 2.0);
        }
    }
    
    /** 立即写入（onDestroy/setPlayerData时使用） */
    private _flushSave(): void {
        this._dirty = false;
        this._saveData();
    }

    /**
     * 升级处理
     */
    private _levelUp(): void {
        const overflowExp = this._playerData.currentExp - this._playerData.expToNextLevel;
        this._playerData.level++;
        this._playerData.currentExp = overflowExp;
        
        // 获取新等级的升级需求
        const nextConfig = this._levelConfigs.find(c => c.level === this._playerData.level + 1);
        this._playerData.expToNextLevel = nextConfig ? nextConfig.requiredExp : Math.floor(this._playerData.expToNextLevel * 1.5);
        
        // 获取当前等级配置
        const currentConfig = this._levelConfigs.find(c => c.level === this._playerData.level);
        
        console.log(`[ExpSystem] 恭喜升级！当前等级: ${this._playerData.level}`);
        
        this._eventTarget.emit('levelUp', {
            level: this._playerData.level,
            newLevel: this._playerData.level,
            unlockCrops: currentConfig?.unlockCrops || [],
            unlockFeatures: currentConfig?.unlockFeatures || [],
            rewardGold: currentConfig?.rewardGold || 0,
        });
        eventBus.emit(GameEvent.LEVEL_UP, {
            level: this._playerData.level,
            newLevel: this._playerData.level,
            unlockCrops: currentConfig?.unlockCrops || [],
            unlockFeatures: currentConfig?.unlockFeatures || [],
            rewardGold: currentConfig?.rewardGold || 0,
        });
    }
    
    /**
     * 初始化等级配置
     */
    private _initLevelConfigs(): void {
        // 生成50个等级的配置
        for (let i = 1; i <= 50; i++) {
            const config: LevelConfig = {
                level: i,
                requiredExp: Math.floor(100 * Math.pow(1.2, i - 1)),
                unlockCrops: this._getUnlockCropsForLevel(i),
                unlockFeatures: this._getUnlockFeaturesForLevel(i),
                rewardGold: i * 50,
            };
            this._levelConfigs.push(config);
        }
    }
    
    /**
     * 获取指定等级解锁的作物
     */
    private _getUnlockCropsForLevel(level: number): number[] {
        // 基础作物在1级解锁
        if (level === 1) {
            return [101, 102, 103, 104]; // 白萝卜、红萝卜、黄瓜、番茄
        }
        // 每5级解锁新作物
        if (level === 5) return [105, 106]; // 土豆、生菜
        if (level === 10) return [107, 108]; // 茄子、辣椒
        if (level === 15) return [109, 110]; // 大葱、大蒜
        if (level === 20) return [111, 112]; // 葡萄、草莓
        if (level === 25) return [113, 114]; // 苹果、梨
        if (level === 30) return [115]; // 樱桃
        return [];
    }
    
    /**
     * 获取指定等级解锁的功能
     */
    private _getUnlockFeaturesForLevel(level: number): string[] {
        const features: string[] = [];
        if (level >= 3) features.push('fertilizer'); // 肥料系统
        if (level >= 5) features.push('pesticide'); // 农药系统
        if (level >= 8) features.push('greenhouse'); // 大棚系统
        if (level >= 10) features.push('market'); // 市场系统
        if (level >= 15) features.push('factory'); // 加工厂
        if (level >= 20) features.push('decoration'); // 装饰系统
        return features;
    }
    
    /**
     * 保存数据
     */
    private _saveData(): void {
        localStorage.setItem('farm_player_data', JSON.stringify(this._playerData));
    }
    
    /**
     * 加载数据
     */
    private _loadData(): void {
        const dataStr = localStorage.getItem('farm_player_data');
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                this._playerData = { ...this._playerData, ...data };
                console.log(`[ExpSystem] 加载玩家数据: 等级${this._playerData.level}, 经验${this._playerData.currentExp}`);
            } catch (e) {
                console.error('[ExpSystem] 加载数据失败:', e);
            }
        }
    }
}
