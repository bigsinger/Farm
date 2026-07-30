import { _decorator, Component, EventTarget } from 'cc';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/**
 * 任务类型枚举
 */
export enum TaskType {
    /** 种植任务 */
    Plant = 1,
    /** 收获任务 */
    Harvest = 2,
    /** 销售任务 */
    Sell = 3,
    /** 扩建任务 */
    Extend = 4,
    /** 连续登录 */
    Login = 5,
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
    /** 未接取 */
    Locked = 0,
    /** 已接受 */
    Active = 1,
    /** 已完成 */
    Completed = 2,
    /** 已领取奖励 */
    Rewarded = 3,
}

/**
 * 任务数据接口
 */
export interface TaskData {
    /** 任务ID */
    id: string;
    /** 任务类型 */
    type: TaskType;
    /** 任务标题 */
    title: string;
    /** 任务描述 */
    description: string;
    /** 目标数量 */
    targetCount: number;
    /** 当前进度 */
    currentCount: number;
    /** 奖励金币 */
    rewardGold: number;
    /** 奖励经验 */
    rewardExp: number;
    /** 任务状态 */
    status: TaskStatus;
    /** 是否日常任务 */
    isDaily: boolean;
    /** 创建时间 */
    createTime: number;
    /** 完成时间 */
    completeTime?: number;
}

/**
 * 任务管理器 - 管理游戏中的任务系统
 * 支持日常任务、成就任务、活动任务
 */
@ccclass('TaskManager')
export class TaskManager extends Component {
    private static _instance: TaskManager = null;
    
    /** 任务列表 */
    private _tasks: Map<string, TaskData> = new Map();
    
    /** 每日任务列表 */
    private _dailyTasks: TaskData[] = [];
    
    /** 事件监听器 */
    private _eventTarget: EventTarget = new EventTarget();
    
    /** 任务配置表 */
    private _taskConfigs: Map<TaskType, { title: string, description: string, rewardGold: number, rewardExp: number }> = new Map([
        [TaskType.Plant, { title: '种植达人', description: '种植{target}个作物', rewardGold: 10, rewardExp: 5 }],
        [TaskType.Harvest, { title: '收获小能手', description: '收获{target}个作物', rewardGold: 20, rewardExp: 10 }],
        [TaskType.Sell, { title: '销售之星', description: '销售{target}个作物', rewardGold: 30, rewardExp: 15 }],
        [TaskType.Extend, { title: '扩建大户', description: '扩建{target}块土地', rewardGold: 50, rewardExp: 25 }],
        [TaskType.Login, { title: '每日登录', description: '登录游戏', rewardGold: 100, rewardExp: 10 }],
    ]);
    
    public static getInstance(): TaskManager {
        if (!this._instance) {
            console.warn('[TaskManager] 实例不存在，请确保场景中已添加 TaskManager 组件');
        }
        return this._instance;
    }
    
    onLoad() {
        if (TaskManager._instance === null) {
            TaskManager._instance = this;
            this._loadTasks();
            this._generateDailyTasks();
            this._registerEventListeners();
            console.log('[TaskManager] 初始化完成，已注册事件监听');
        } else {
            this.destroy();
        }
    }

    onDestroy() {
        if (TaskManager._instance === this) {
            this._unregisterEventListeners();
            this._flushSave();
            TaskManager._instance = null;
        }
    }

    /** 数据脏标记（避免高频写入localStorage） */
    private _dirty: boolean = false;

    // ==================== EventBus 事件监听 ====================

    /**
     * 注册事件监听 - 监听游戏事件以自动更新任务进度
     */
    private _registerEventListeners(): void {
        eventBus.on(GameEvent.CROP_PLANTED, this._onCropPlanted, this);
        eventBus.on(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.on(GameEvent.WAREHOUSE_SOLD, this._onWarehouseSold, this);
        eventBus.on(GameEvent.SHOP_ITEM_BOUGHT, this._onShopItemBought, this);
        eventBus.on(GameEvent.GAME_LOADED, this._onGameLoaded, this);
    }

    /**
     * 取消事件监听
     */
    private _unregisterEventListeners(): void {
        eventBus.off(GameEvent.CROP_PLANTED, this._onCropPlanted, this);
        eventBus.off(GameEvent.CROP_HARVESTED, this._onCropHarvested, this);
        eventBus.off(GameEvent.WAREHOUSE_SOLD, this._onWarehouseSold, this);
        eventBus.off(GameEvent.SHOP_ITEM_BOUGHT, this._onShopItemBought, this);
        eventBus.off(GameEvent.GAME_LOADED, this._onGameLoaded, this);
    }

    /** 种植事件 - 更新种植任务 */
    private _onCropPlanted(data: any): void {
        this.updateProgress(TaskType.Plant, 1);
    }

    /** 收获事件 - 更新收获任务 */
    private _onCropHarvested(data: any): void {
        this.updateProgress(TaskType.Harvest, 1);
    }

    /** 出售事件 - 更新销售任务 */
    private _onWarehouseSold(data: any): void {
        const count = data?.count || 1;
        this.updateProgress(TaskType.Sell, count);
    }

    /** 购买事件 - 更新购买任务 */
    private _onShopItemBought(data: any): void {
        // 商店购买可能关联不同任务类型，暂不计入
    }

    /** 游戏加载完成 - 处理登录任务 */
    private _onGameLoaded(data: any): void {
        this.updateProgress(TaskType.Login, 1);
    }
    
    // ==================== 任务操作 ====================
    
    /**
     * 接受任务
     */
    public acceptTask(taskId: string): boolean {
        const task = this._tasks.get(taskId);
        if (!task || task.status !== TaskStatus.Locked) {
            return false;
        }
        
        task.status = TaskStatus.Active;
        this._saveTasks();
        this._eventTarget.emit('taskAccepted', task);
        eventBus.emit(GameEvent.TASK_ACCEPTED, { taskId: task.id, title: task.title });
        console.log(`[TaskManager] 接受任务: ${task.title}`);
        return true;
    }
    
    /**
     * 更新任务进度
     */
    public updateProgress(type: TaskType, count: number = 1): void {
        // 更新普通任务
        for (const task of this._tasks.values()) {
            if (task.type === type && task.status === TaskStatus.Active) {
                task.currentCount += count;
                if (task.currentCount >= task.targetCount) {
                    task.status = TaskStatus.Completed;
                    task.completeTime = Date.now();
                    this._eventTarget.emit('taskCompleted', task);
                    eventBus.emit(GameEvent.TASK_COMPLETED, { taskId: task.id, title: task.title });
                    console.log(`[TaskManager] 任务完成: ${task.title}`);
                }
            }
        }

        // 更新日常任务
        for (const task of this._dailyTasks) {
            if (task.type === type && task.status === TaskStatus.Active) {
                task.currentCount += count;
                if (task.currentCount >= task.targetCount) {
                    task.status = TaskStatus.Completed;
                    task.completeTime = Date.now();
                    this._eventTarget.emit('dailyTaskCompleted', task);
                    eventBus.emit(GameEvent.TASK_COMPLETED, { taskId: task.id, title: task.title, isDaily: true });
                    console.log(`[TaskManager] 日常任务完成: ${task.title}`);
                }
            }
        }
        
        this._markDirty();
    }
    /**
     * 领取任务奖励
     */
    public claimReward(taskId: string): { gold: number, exp: number } | null {
        const task = this._tasks.get(taskId);
        if (!task || task.status !== TaskStatus.Completed) {
            return null;
        }
        
        task.status = TaskStatus.Rewarded;
        this._saveTasks();
        this._eventTarget.emit('rewardClaimed', task);
        eventBus.emit(GameEvent.TASK_REWARD_CLAIMED, { taskId: task.id, title: task.title, gold: task.rewardGold, exp: task.rewardExp });
        console.log(`[TaskManager] 领取奖励: ${task.title} - 金币:${task.rewardGold}, 经验:${task.rewardExp}`);
        
        return { gold: task.rewardGold, exp: task.rewardExp };
    }
    
    /**
     * 创建新任务
     */
    public createTask(type: TaskType, targetCount: number, isDaily: boolean = false): TaskData {
        const config = this._taskConfigs.get(type);
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const task: TaskData = {
            id: taskId,
            type: type,
            title: config?.title || '未知任务',
            description: config?.description.replace('{target}', targetCount.toString()) || '',
            targetCount: targetCount,
            currentCount: 0,
            rewardGold: config?.rewardGold || 0,
            rewardExp: config?.rewardExp || 0,
            status: isDaily ? TaskStatus.Active : TaskStatus.Locked,
            isDaily: isDaily,
            createTime: Date.now(),
        };
        
        if (isDaily) {
            this._dailyTasks.push(task);
        } else {
            this._tasks.set(taskId, task);
        }
        
        this._saveTasks();
        this._eventTarget.emit('taskCreated', task);
        return task;
    }
    
    // ==================== 查询方法 ====================

    /**
     * 加载存档数据（用于SaveManager恢复）
     */
    public loadSaveData(data: { all?: TaskData[], daily?: TaskData[] }): void {
        this._tasks.clear();
        this._dailyTasks = [];

        if (data.all) {
            for (const task of data.all) {
                this._tasks.set(task.id, task);
            }
        }
        if (data.daily) {
            this._dailyTasks = data.daily;
        }

        this._saveTasks();
        console.log(`[TaskManager] 恢复任务数据: ${this._tasks.size} 个任务, ${this._dailyTasks.length} 个日常任务`);
    }

    /**
     * 获取所有任务
     */
    public getAllTasks(): TaskData[] {
        return Array.from(this._tasks.values());
    }
    
    /**
     * 获取活跃任务
     */
    public getActiveTasks(): TaskData[] {
        return this.getAllTasks().filter(t => t.status === TaskStatus.Active);
    }
    
    /**
     * 获取已完成但未领取奖励的任务
     */
    public getCompletedTasks(): TaskData[] {
        return this.getAllTasks().filter(t => t.status === TaskStatus.Completed);
    }
    
    /**
     * 获取日常任务
     */
    public getDailyTasks(): TaskData[] {
        return [...this._dailyTasks];
    }
    
    /**
     * 获取任务统计信息
     */
    public getTaskStats(): { total: number, active: number, completed: number, rewarded: number } {
        const tasks = this.getAllTasks();
        return {
            total: tasks.length,
            active: tasks.filter(t => t.status === TaskStatus.Active).length,
            completed: tasks.filter(t => t.status === TaskStatus.Completed).length,
            rewarded: tasks.filter(t => t.status === TaskStatus.Rewarded).length,
        };
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
     * 避免高频事件（连续收获/种植/销售）导致的同步阻塞
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
        this._saveTasks();
    }

    /**
     * 生成每日任务
     */
    private _generateDailyTasks(): void {
        // 检查是否需要重置日常任务
        const lastResetTime = this._getLastDailyResetTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (now - lastResetTime >= oneDay) {
            this._dailyTasks = [];
            
            // 生成3个随机日常任务
            const dailyTypes = [TaskType.Plant, TaskType.Harvest, TaskType.Sell];
            for (const type of dailyTypes) {
                const targetCount = Math.floor(Math.random() * 5) + 3; // 3-7个
                this.createTask(type, targetCount, true);
            }
            
            // 添加登录任务
            this.createTask(TaskType.Login, 1, true);
            
            this._setLastDailyResetTime(now);
            console.log('[TaskManager] 生成新的每日任务');
        }
    }
    
    /**
     * 保存任务数据
     */
    private _saveTasks(): void {
        const data = {
            tasks: Array.from(this._tasks.values()),
            dailyTasks: this._dailyTasks,
        };
        localStorage.setItem('farm_tasks', JSON.stringify(data));
    }
    
    /**
     * 加载任务数据
     */
    private _loadTasks(): void {
        const dataStr = localStorage.getItem('farm_tasks');
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                if (data.tasks) {
                    for (const task of data.tasks) {
                        this._tasks.set(task.id, task);
                    }
                }
                if (data.dailyTasks) {
                    this._dailyTasks = data.dailyTasks;
                }
                console.log(`[TaskManager] 加载了 ${this._tasks.size} 个任务`);
            } catch (e) {
                console.error('[TaskManager] 加载任务数据失败:', e);
            }
        }
    }
    
    private _getLastDailyResetTime(): number {
        const timeStr = localStorage.getItem('farm_daily_reset_time');
        return timeStr ? parseInt(timeStr) : 0;
    }
    
    private _setLastDailyResetTime(time: number): void {
        localStorage.setItem('farm_daily_reset_time', time.toString());
    }
}
