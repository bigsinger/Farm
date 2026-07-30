import { _decorator, Component } from 'cc';
import { eventBus, GameEvent } from './EventBus';

const { ccclass, property } = _decorator;

export interface TutorialStepDef {
    id: string;
    title: string;
    description: string;
    action: string;
    targetEvent?: GameEvent;
    panelName?: string;
}

/**
 * 新手引导管理器
 * 
 * 功能：
 * - 逐步引导玩家了解游戏机制
 * - 高亮目标UI元素
 * - 完成步骤后自动推进
 * - 支持跳过引导
 * - 引导完成后不再触发
 */
@ccclass('TutorialManager')
export class TutorialManager extends Component {
    private static instance: TutorialManager = null;

    // 引导步骤定义
    private readonly TUTORIAL_STEPS: TutorialStepDef[] = [
        {
            id: 'welcome',
            title: '欢迎来到农场',
            description: '这是你的第一块农田，让我们一起学习种地吧！',
            action: 'tap_anywhere',
        },
        {
            id: 'plant_crop',
            title: '种植作物',
            description: '点击空地可以种植作物，选择一种作物开始种植吧！',
            action: 'plant_crop',
            targetEvent: GameEvent.CROP_PLANTED,
        },
        {
            id: 'wait_growth',
            title: '等待生长',
            description: '作物需要时间生长，耐心等待它成熟吧！',
            action: 'wait',
        },
        {
            id: 'harvest',
            title: '收获作物',
            description: '作物成熟后会闪闪发光，点击它来收获！',
            action: 'harvest',
            targetEvent: GameEvent.CROP_HARVESTED,
        },
        {
            id: 'open_warehouse',
            title: '查看仓库',
            description: '收获的作物会存放在仓库里，打开仓库看看吧！',
            action: 'open_panel',
            panelName: 'warehouse',
            targetEvent: GameEvent.UI_OPEN,
        },
        {
            id: 'sell_crop',
            title: '出售作物',
            description: '在仓库中可以出售作物换取金币！',
            action: 'sell',
            targetEvent: GameEvent.WAREHOUSE_SOLD,
        },
        {
            id: 'open_shop',
            title: '访问商店',
            description: '用赚到的金币在商店购买更多种子吧！',
            action: 'open_panel',
            panelName: 'shop',
            targetEvent: GameEvent.UI_OPEN,
        },
        {
            id: 'buy_seed',
            title: '购买种子',
            description: '选择一种种子购买，种更多的作物！',
            action: 'buy',
            targetEvent: GameEvent.SHOP_ITEM_BOUGHT,
        },
        {
            id: 'expand',
            title: '扩建农场',
            description: '点击扩建牌可以扩大农田面积！',
            action: 'expand',
        },
        {
            id: 'complete',
            title: '引导完成',
            description: '恭喜你掌握了基本操作，继续发展你的农场吧！',
            action: 'complete',
        },
    ];

    // 当前状态
    private _currentStep: number = 0;
    private _isCompleted: boolean = false;
    private _isSkipped: boolean = false;
    private _isWaitingForAction: boolean = false;

    // 回调
    private _onStepChangeCallbacks: ((step: TutorialStepDef, index: number) => void)[] = [];

    // 事件名
    public static readonly EVENT_STEP_CHANGED = 'tutorial_step_changed';
    public static readonly EVENT_COMPLETED = 'tutorial_completed';

    // ==================== 单例 ====================

    onLoad() {
        if (TutorialManager.instance) {
            this.node.destroy();
            return;
        }
        TutorialManager.instance = this;
        console.log('[TutorialManager] 初始化完成');
    }

    onDestroy() {
        if (TutorialManager.instance === this) {
            TutorialManager.instance = null;
        }
        this.unregisterEventListeners();
    }

    public static getInstance(): TutorialManager {
        return TutorialManager.instance;
    }

    // ==================== 公共 API ====================

    /** 是否已完成引导 */
    public get isCompleted(): boolean {
        return this._isCompleted;
    }

    /** 是否已跳过 */
    public get isSkipped(): boolean {
        return this._isSkipped;
    }

    /** 当前步骤索引 */
    public get currentStepIndex(): number {
        return this._currentStep;
    }

    /** 当前步骤 */
    public get currentStep(): TutorialStepDef {
        return this.TUTORIAL_STEPS[this._currentStep];
    }

    /** 总步骤数 */
    public get totalSteps(): number {
        return this.TUTORIAL_STEPS.length;
    }

    /** 开始引导 */
    public start() {
        if (this._isCompleted) return;
        this._currentStep = 0;
        this.showCurrentStep();
    }

    /** 跳过引导 */
    public skip() {
        this._isSkipped = true;
        this._isCompleted = true;
        this.unregisterEventListeners();
        this.node.emit(TutorialManager.EVENT_COMPLETED);
        eventBus.emit(GameEvent.TUTORIAL_COMPLETED);
        console.log('[TutorialManager] 引导已跳过');
    }

    /** 注册步骤变化回调 */
    public onStepChange(callback: (step: TutorialStepDef, index: number) => void) {
        this._onStepChangeCallbacks.push(callback);
    }

    /** 获取存档数据 */
    public getSaveData() {
        return {
            currentStep: this._currentStep,
            isCompleted: this._isCompleted,
            isSkipped: this._isSkipped,
        };
    }

    /** 从存档恢复 */
    public restoreFromSave(data: { currentStep: number; isCompleted: boolean; isSkipped: boolean }) {
        if (data) {
            this._currentStep = data.currentStep || 0;
            this._isCompleted = data.isCompleted || false;
            this._isSkipped = data.isSkipped || false;
            console.log(`[TutorialManager] 从存档恢复: 步骤 ${this._currentStep}, 完成=${this._isCompleted}`);
        }
    }

    // ==================== 内部方法 ====================

    /** 显示当前步骤 */
    private showCurrentStep() {
        if (this._currentStep >= this.TUTORIAL_STEPS.length) {
            this.completeTutorial();
            return;
        }

        const step = this.TUTORIAL_STEPS[this._currentStep];
        console.log(`[TutorialManager] 步骤 ${this._currentStep + 1}/${this.totalSteps}: ${step.title}`);
        console.log(`[TutorialManager] ${step.description}`);

        // 通知UI更新
        this.node.emit(TutorialManager.EVENT_STEP_CHANGED, step, this._currentStep);
        eventBus.emit(GameEvent.TUTORIAL_STEP_CHANGED, { step, index: this._currentStep });
        for (const cb of this._onStepChangeCallbacks) {
            cb(step, this._currentStep);
        }

        // 注册事件监听（等待玩家操作）
        this.registerEventListeners(step);
    }

    /** 注册事件监听 */
    private registerEventListeners(step: TutorialStepDef) {
        this.unregisterEventListeners();

        if (step.targetEvent) {
            this._isWaitingForAction = true;
            eventBus.on(step.targetEvent, this.onTargetEvent, this);
        } else if (step.action === 'tap_anywhere' || step.action === 'wait' || step.action === 'expand') {
            // 自动推进
            this.scheduleOnce(() => this.advanceStep(), step.action === 'wait' ? 2 : 0.5);
        } else if (step.action === 'complete') {
            this.scheduleOnce(() => this.completeTutorial(), 1);
        }
    }

    /** 取消事件监听 */
    private unregisterEventListeners() {
        this._isWaitingForAction = false;
        // 取消所有定时器
        this.unscheduleAllCallbacks();
        // 注意：off需要callback引用，这里用简单方式全部清除
        const step = this.TUTORIAL_STEPS[this._currentStep];
        if (step && step.targetEvent) {
            eventBus.off(step.targetEvent, this.onTargetEvent, this);
        }
    }

    /** 目标事件触发 */
    private onTargetEvent(data: any) {
        if (!this._isWaitingForAction) return;

        const step = this.TUTORIAL_STEPS[this._currentStep];
        if (step.panelName && data && data.panel !== step.panelName) {
            return; // 不是目标面板的事件，忽略
        }

        this._isWaitingForAction = false;
        this.advanceStep();
    }

    /** 推进到下一步 */
    private advanceStep() {
        this._currentStep++;
        this.showCurrentStep();
    }

    /** 完成引导 */
    private completeTutorial() {
        if (this._isCompleted) return;
        this._isCompleted = true;
        this.unregisterEventListeners();
        this.node.emit(TutorialManager.EVENT_COMPLETED);
        eventBus.emit(GameEvent.TUTORIAL_COMPLETED);
        eventBus.emit(GameEvent.ACHIEVEMENT_PROGRESS, { achievementId: 'tutorial_complete' });
        console.log('[TutorialManager] ✅ 新手引导完成！');
    }
}

/** 引导步骤定义（类型定义在 global.d.ts） */
