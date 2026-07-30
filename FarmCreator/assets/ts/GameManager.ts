import { _decorator, Component, director, find, game, Node, Label, Color, UITransform, Graphics, tween, UIOpacity, Layers, Widget, resources, SpriteAtlas, Sprite, SpriteFrame, Animation, AnimationClip, Vec3 } from 'cc';
import { CropData } from './Crop';
import { UIManager } from './UIManager';
import { CurrencySystem } from './CurrencySystem';
import { WarehouseManager } from './WarehouseManager';
import { ShopManager } from './ShopManager';
import { ExpSystem } from './ExpSystem';
import { TaskManager } from './TaskManager';
import { AchievementManager } from './AchievementManager';
import { MarketOrderManager } from './MarketOrderManager';
import { TimeSystem } from './TimeSystem';
import { WeatherSystem } from './WeatherSystem';
import { FriendsSystem } from './FriendsSystem';
import { TutorialManager } from './TutorialManager';
import { SaveManager } from './SaveManager';
import { AnimationSystem } from './AnimationSystem';
import { PerformanceSystem } from './PerformanceSystem';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/**
 * 游戏生命周期管理器
 *
 * 职责：
 * - 游戏启动初始化（资源加载、场景切换）
 * - 各系统按依赖顺序创建和初始化
 * - 系统间依赖注入和协调
 * - 游戏退出清理
 *
 * 初始化顺序：
 * 1. 资源加载（CropData等）
 * 2. 场景切换到 MainScene
 * 3. 核心模拟系统创建（TimeSystem → WeatherSystem → FriendsSystem → TutorialManager）
 * 4. 经济成长系统创建（Currency/Warehouse/Shop/Exp/Task/Achievement/MarketOrder）
 * 5. PerformanceSystem（性能优化，在SaveManager前创建以便提供对象池）
 * 6. AnimationSystem（动画系统，在UIManager前创建以便提供动画接口）
 * 7. SaveManager（恢复存档）
 * 8. UIManager（UI层最后初始化，依赖所有系统就绪）
 */
@ccclass('GameManager')
export class GameManager extends Component {
    private _loadStartTime: number = 0;
    private _loadingNode: Node | null = null;    // 加载界面节点

    async onLoad() {
        // BootScene 只承载启动器；保持根节点常驻，确保切换到 MainScene 后初始化流程不会中断。
        game.addPersistRootNode(this.node);
        this._loadStartTime = performance.now();
        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] onLoad 启动`);

        // ── 步骤0：立即显示加载界面（0ms 可见，改善感知速度）──
        this._showLoadingScreen();

        // ── 步骤1：并行加载场景 + 数据资源 ──
        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 开始并行加载 MainScene 和 数据资源...`);

        // 1a. 启动场景加载（异步不阻塞）
        const sceneReady = this._preloadAndLaunchMainScene();

        // 1b. 并行加载数据资源
        const initStart = performance.now();
        this._updateLoadProgress(0.05);  // 开始加载数据
        try {
            // 场景和配置数据互不依赖，可以并行等待，缩短首屏时间。
            await Promise.all([this.initialize(), sceneReady]);
        } catch (error) {
            // onLoad 是异步方法，必须在这里收口异常，否则会形成难定位的未处理 Promise。
            console.error('[GameManager] 启动资源加载失败:', error);
            this._showLoadFailure();
            return;
        }
        const initCost = (performance.now() - initStart).toFixed(1);
        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 场景与数据资源加载完成 (耗时 ${initCost}ms)`);
        this._updateLoadProgress(0.85);

        // ── 步骤2：分帧初始化各系统（允许渲染帧穿插，保持加载界面动画流畅）──
        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 开始初始化各系统...`);
        this.scheduleOnce(() => {
            this._initSystemsBatch(0);
        }, 0);
    }

    /**
     * Creator 3.8 的 loadScene 回调是场景启动回调，不是加载进度回调。
     * 先 preloadScene 获取真实进度，再切换并等待场景激活。
     */
    private _preloadAndLaunchMainScene(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            director.preloadScene(
                'MainScene',
                (completedCount, totalCount) => {
                    if (totalCount > 0) {
                        this._updateLoadProgress(0.3 + (completedCount / totalCount) * 0.4);
                    }
                },
                (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    director.loadScene('MainScene', (loadError) => {
                        if (loadError) {
                            reject(loadError);
                            return;
                        }
                        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] MainScene 场景激活完成`);
                        resolve();
                    });
                },
            );
        });
    }

    /**
     * 分帧初始化系统（每次处理2个系统，然后延迟一帧继续）
     * 这样可以在系统初始化期间保持加载界面动画的流畅性
     */
    private _initSystemsBatch(batchIndex: number) {
        const batches = [
            () => this._initCoreSystems(),      // 批次0：核心系统 (Time, Weather, Friends, Tutorial)
            () => this._initEconomySystems(),   // 批次1：经济/成长系统
            () => this._initSupportSystems(),   // 批次2：支撑系统 (Performance, Animation)
            () => this._initLateSystems(),      // 批次3：后端系统 (Save, UI)
        ];

        if (batchIndex < batches.length) {
            batches[batchIndex]();
            const progress = 0.85 + (batchIndex + 1) / batches.length * 0.13;
            this._updateLoadProgress(progress);

            if (batchIndex < batches.length - 1) {
                this.scheduleOnce(() => {
                    this._initSystemsBatch(batchIndex + 1);
                }, 0.05);
            } else {
                // 最后一批完成 → 隐藏加载界面
                this._finishLoading();
            }
        }
    }

    /** 批次0：核心系统 */
    private _initCoreSystems() {
        const canvas = find('Canvas');
        if (!canvas) return;
        this.ensureSystem<TimeSystem>('TimeSystem', canvas, TimeSystem);
        this.ensureSystem<WeatherSystem>('WeatherSystem', canvas, WeatherSystem);
        this.ensureSystem<FriendsSystem>('FriendsSystem', canvas, FriendsSystem);
        this.ensureSystem<TutorialManager>('TutorialManager', canvas, TutorialManager);
    }

    /** 批次1：经济/成长系统 */
    private _initEconomySystems() {
        const canvas = find('Canvas');
        if (!canvas) return;
        this.ensureSystem<CurrencySystem>('CurrencySystem', canvas, CurrencySystem);
        this.ensureSystem<WarehouseManager>('WarehouseManager', canvas, WarehouseManager);
        this.ensureSystem<ShopManager>('ShopManager', canvas, ShopManager);
        this.ensureSystem<ExpSystem>('ExpSystem', canvas, ExpSystem);
        this.ensureSystem<TaskManager>('TaskManager', canvas, TaskManager);
        this.ensureSystem<AchievementManager>('AchievementManager', canvas, AchievementManager);
        this.ensureSystem<MarketOrderManager>('MarketOrderManager', canvas, MarketOrderManager);
    }

    /** 批次2：支撑系统 */
    private _initSupportSystems() {
        const canvas = find('Canvas');
        if (!canvas) return;
        this.ensureSystem<PerformanceSystem>('PerformanceSystem', canvas, PerformanceSystem);
        this.ensureSystem<AnimationSystem>('AnimationSystem', canvas, AnimationSystem);
    }

    /** 批次3：后端系统 */
    private _initLateSystems() {
        const canvas = find('Canvas');
        if (!canvas) return;

        // 商店、仓库和状态牌都位于 bandLayer。把交互层提升到场景装饰与作物层之上，
        // 避免成熟作物较大的触摸区域拦截建筑点击。
        const bandLayer = canvas.getChildByName('bandLayer');
        if (bandLayer) {
            bandLayer.setSiblingIndex(canvas.children.length - 1);
        }

        this.ensureSystem<SaveManager>('SaveManager', canvas, SaveManager);
        this.ensureUIManager();
    }

    /** 加载完成：销毁加载界面，启动游戏 */
    private _finishLoading() {
        this._updateLoadProgress(1.0);
        const total = (performance.now() - this._loadStartTime).toFixed(0);
        console.log(`[GameManager] ⏱️  🎉 启动总耗时: ${total}ms`);

        // 延迟一帧隐藏加载界面（确保进度条动画完成）
        this.scheduleOnce(() => {
            this._hideLoadingScreen();
            eventBus.emit(GameEvent.GAME_LOADED, { timestamp: Date.now() });
            this.loadDeferredAssets();
        }, 0.3);
    }

    /**
     * 初始化资源（场景切换前）
     */
    async initialize() {
        const cropStart = performance.now();
        await CropData.deserializeAll();
        const cropCost = (performance.now() - cropStart).toFixed(1);
        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms]   ├─ CropData.deserializeAll 完成 (耗时 ${cropCost}ms)`);
    }

    // ═══════════════════════════════════════════════
    // 加载界面（0ms可见，改善启动感知速度）
    // ═══════════════════════════════════════════════
    private _loadingBg: Node | null = null;
    private _loadingBar: Node | null = null;
    private _loadingText: Node | null = null;
    private _loadingProgress: number = 0;

    /**
     * 显示加载界面（全屏暗色覆盖 + 进度条 + 文字）
     * 在 onLoad 第一时间调用，确保用户立即看到反馈
     */
    private _showLoadingScreen() {
        const canvas = find('Canvas') || this.node.scene.getChildByName('Canvas');
        if (!canvas) {
            // BootScene 极简启动器没有 Canvas，短启动阶段沿用引擎启动画面。
            return;
        }

        const W = 720;  // 标准宽度
        const H = 1280;

        // 加载界面容器
        const loadingRoot = new Node('LoadingScreen');
        loadingRoot.layer = Layers.Enum.UI_2D;
        const rootUt = loadingRoot.addComponent(UITransform);
        rootUt.setContentSize(W, H);
        loadingRoot.parent = canvas;
        // 确保在最上层
        loadingRoot.setSiblingIndex(canvas.children.length - 1);
        this._loadingNode = loadingRoot;

        // 全屏黑色半透明背景
        const bg = new Node('LoadingBg');
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(W, H);
        bg.parent = loadingRoot;
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(0, 0, 0, 220);
        bgG.rect(-W / 2, -H / 2, W, H);
        bgG.fill();
        this._loadingBg = bg;

        // 中心容器
        const center = new Node('Center');
        center.layer = Layers.Enum.UI_2D;
        const centerUt = center.addComponent(UITransform);
        centerUt.setContentSize(600, 200);
        center.parent = loadingRoot;

        // 标题文字
        const titleNode = new Node('Title');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.setPosition(0, 60, 0);
        const titleUt = titleNode.addComponent(UITransform);
        titleUt.setContentSize(600, 50);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '加载中...';
        titleLabel.fontSize = 36;
        titleLabel.color = new Color(200, 200, 200, 255);
        titleLabel.overflow = Label.Overflow.CLAMP;
        titleNode.parent = center;

        // 进度条背景
        const barBg = new Node('BarBg');
        barBg.layer = Layers.Enum.UI_2D;
        barBg.setPosition(0, 0, 0);
        const barBgUt = barBg.addComponent(UITransform);
        barBgUt.setContentSize(400, 12);
        barBg.parent = center;
        const barBgG = barBg.addComponent(Graphics);
        barBgG.fillColor = new Color(60, 60, 60, 200);
        barBgG.roundRect(-200, -6, 400, 12, 6);
        barBgG.fill();

        // 进度条填充（初始宽度0）
        const barFill = new Node('BarFill');
        barFill.layer = Layers.Enum.UI_2D;
        barFill.setPosition(-200, 0, 0);  // 左对齐，锚点在左侧
        const barFillUt = barFill.addComponent(UITransform);
        barFillUt.setContentSize(0, 10);
        barFillUt.setAnchorPoint(0, 0.5); // 左锚点，方便设置宽度
        barFill.parent = center;
        const barFillG = barFill.addComponent(Graphics);
        barFillG.fillColor = new Color(80, 180, 80, 255);
        barFillG.clear();
        barFillG.roundRect(0, -5, 400, 10, 5);
        barFillG.fill();
        this._loadingBar = barFill;

        // 进度文字 (百分比)
        const textNode = new Node('Progress');
        textNode.layer = Layers.Enum.UI_2D;
        textNode.setPosition(0, -30, 0);
        const textUt = textNode.addComponent(UITransform);
        textUt.setContentSize(400, 30);
        const textLabel = textNode.addComponent(Label);
        textLabel.string = '0%';
        textLabel.fontSize = 22;
        textLabel.color = new Color(160, 160, 160, 255);
        textLabel.overflow = Label.Overflow.CLAMP;
        textNode.parent = center;
        this._loadingText = textNode;

        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 加载界面已显示`);
    }

    /** 更新加载进度 (0.0 ~ 1.0) */
    private _updateLoadProgress(progress: number) {
        // 外部进度来自不同加载阶段，先钳制范围，避免异常回调撑破进度条。
        progress = Math.max(0, Math.min(1, progress));
        if (progress < this._loadingProgress) return;  // 只增不减
        this._loadingProgress = progress;

        // 更新进度条宽度
        if (this._loadingBar) {
            const barUt = this._loadingBar.getComponent(UITransform);
            if (barUt) {
                barUt.setContentSize(400 * progress, 10);
            }
        }
        // 更新百分比文字
        if (this._loadingText) {
            const textLabel = this._loadingText.getComponent(Label);
            if (textLabel) {
                textLabel.string = `${Math.round(progress * 100)}%`;
            }
        }
    }

    /** 启动失败时保留加载层并给出明确提示，避免用户只看到静止画面。 */
    private _showLoadFailure(): void {
        const textLabel = this._loadingText?.getComponent(Label);
        if (textLabel) {
            textLabel.string = '加载失败，请刷新后重试';
            textLabel.color = new Color(224, 96, 76, 255);
        }
    }

    /** 隐藏加载界面（淡出动画） */
    private _hideLoadingScreen() {
        if (!this._loadingNode) return;

        const loadingNode = this._loadingNode;
        this._loadingNode = null;

        // 淡出动画
        const opacity = loadingNode.addComponent(UIOpacity);
        tween(opacity)
            .to(0.3, { opacity: 0 })
            .call(() => {
                loadingNode.destroy();
            })
            .start();

        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 加载界面关闭`);
    }

    /**
     * 延迟加载非核心资产（场景装饰、动画、音效等）
     *
     * 这些资产在 MainScene.scene 中的引用已被清除（避免阻塞场景加载），
     * 现在通过 resources.load 异步按需加载。
     *
     * 节省的同步加载资产：
     * - sanguo/res_1  spritesheet (5.1MB) → mountain 节点装饰
     * - animation/bird  动画片段 (410KB) → bird 节点动画
     * - fireworks 动画 → brand.ts 点击时按需加载（不阻塞启动）
     * - bgm 音频 → AudioController 自行加载
     */
    private loadDeferredAssets() {
        // ---- mountain 精灵 (sanguo spritesheet, 5.1MB) ----
        const mountain = find('Canvas/backLayer/mountain');
        if (mountain) {
            console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 开始延迟加载 sanguo spritesheet...`);
            resources.loadDir('sanguo', SpriteAtlas, (err, atlases) => {
                if (err || !atlases || atlases.length === 0) {
                    console.warn(`[GameManager] sanguo spritesheet 加载失败:`, err || 'no atlas');
                    return;
                }
                const atlas = atlases[0] as SpriteAtlas;
                const sprite = mountain.getComponent(Sprite);
                if (sprite && atlas) {
                    const frames = atlas.getSpriteFrames();
                    if (frames && frames.length > 0) {
                        sprite.spriteFrame = frames[0];
                        mountain.active = true;
                        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] sanguo spritesheet 加载完成 (${frames.length}帧)`);
                    } else {
                        console.warn(`[GameManager] sanguo atlas 加载成功但无帧`);
                    }
                }
            });
        }

        // ---- bird 飞鸟（异步加载图集 + 动画 + 飞行运动） ----
        const bird = find('Canvas/effectLayer/bird');
        if (bird) {
            console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] 开始延迟加载 bird 飞鸟...`);
            // 先加载 bird 图集 (155帧飞行动画序列)，再加载动画
            resources.load('effect/bird/bird', SpriteAtlas, (err, atlas) => {
                if (err || !atlas) {
                    console.warn(`[GameManager] bird 图集加载失败:`, err || 'atlas is null');
                    return;
                }
                const spr = bird.getComponent(Sprite);
                if (spr) {
                    const frames = atlas.getSpriteFrames();
                    if (frames && frames.length > 0) {
                        spr.spriteFrame = frames[0];
                    }
                }
                // 加载并播放飞鸟帧动画
                resources.load('animation/bird', AnimationClip, (err2, clip) => {
                    if (err2 || !clip) {
                        console.warn(`[GameManager] bird 动画加载失败:`, err2 || 'clip is null');
                        return;
                    }
                    const anim = bird.getComponent(Animation);
                    const uiTransform = bird.getComponent(UITransform);
                    if (anim && clip && uiTransform) {
                        anim.defaultClip = clip;
                        anim.addClip(clip, 'bird');
                        anim.play();

                        // 飞鸟循环飞行（跟随云朵风格）
                        const birdWidth = uiTransform.contentSize.width;
                        const canvasWidth = 800;
                        const startX = canvasWidth / 2 + birdWidth;
                        const endX = -canvasWidth / 2 - birdWidth;
                        bird.setPosition(startX, bird.position.y, 0);
                        const flyDuration = 30;
                        tween(bird)
                            .delay(1)
                            .to(flyDuration, { position: new Vec3(endX, bird.position.y, 0) })
                            .call(() => {
                                bird.setPosition(startX, bird.position.y, 0);
                            })
                            .union()
                            .repeatForever()
                            .start();

                        console.log(`[GameManager] ⏱️  [${this._elapsed()}ms] bird 飞鸟动画加载完成 (${atlas.getSpriteFrames().length}帧)`);
                    }
                });
            });
        }
    }

    /**
     * 计算距离加载开始的时间
     */
    private _elapsed(): string {
        return (performance.now() - this._loadStartTime).toFixed(1);
    }

    /**
     * 确保指定系统组件存在（通用方法）
     */
    private ensureSystem<T extends Component>(name: string, parent: Node, cls: new (...args: any[]) => T): T | null {
        // 系统都挂在当前 Canvas 下，直接从父节点查找比全场景路径搜索更稳定。
        let node = parent.getChildByName(name);
        if (node) {
            const comp = node.getComponent(cls);
            if (comp) {
                console.log(`[GameManager] ${name} 已存在，跳过创建`);
                return comp;
            }
        }

        console.log(`[GameManager] 创建 ${name} 节点`);
        node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        const comp = node.addComponent(cls);
        console.log(`[GameManager] ${name} 创建完成`);
        return comp;
    }

    /**
     * 确保UIManager存在
     */
    private ensureUIManager() {
        let uiManager = find('Canvas/UIManager');

        if (!uiManager) {
            console.log('[GameManager] 创建UIManager节点');
            const canvas = find('Canvas');
            if (!canvas) {
                console.warn('[GameManager] 找不到Canvas节点');
                return;
            }

            uiManager = new Node('UIManager');
            uiManager.layer = Layers.Enum.UI_2D;
            uiManager.parent = canvas;
            uiManager.addComponent(UIManager);
            console.log('[GameManager] UIManager节点创建完成');
        } else {
            console.log('[GameManager] UIManager节点已存在');
        }
    }
}
