import { _decorator, Component, Node, Layers, find, Label, Sprite, UITransform } from 'cc';
import { UISimplePanel } from './UISimplePanel';
import { UIFriendsPanel } from './UIFriendsPanel';
import { UITutorial } from './UITutorial';
import { eventBus, GameEvent } from './EventBus';
import { AnimationSystem } from './AnimationSystem';
import { CurrencySystem } from './CurrencySystem';
import { ExpSystem } from './ExpSystem';
const { ccclass } = _decorator;

/**
 * UI管理器 - 统一管理游戏中的UI面板
 */
@ccclass('UIManager')
export class UIManager extends Component {
    private static instance: UIManager | null = null;

    // 当前打开的面板
    private currentShopPanel: Node = null;
    private currentWarehousePanel: Node = null;
    private currentSavePanel: Node = null;
    private currentFriendsPanel: Node = null;
    private currentTutorialPanel: Node = null;

    onLoad() {
        if (UIManager.instance) {
            this.node.destroy();
            return;
        }
        UIManager.instance = this;

        // 监听UI关闭事件
        eventBus.on(GameEvent.UI_CLOSE, this.onUIClose, this);
        // 主界面信息牌原先只有静态标题，这里把它接到真实经济/等级数据。
        eventBus.on(GameEvent.GOLD_CHANGED, this.refreshStatusBand, this);
        eventBus.on(GameEvent.EXP_GAINED, this.refreshStatusBand, this);
        eventBus.on(GameEvent.LEVEL_UP, this.refreshStatusBand, this);
        this.refreshStatusBand();

        console.log('[UIManager] 初始化完成');
    }

    onDestroy() {
        if (UIManager.instance === this) {
            UIManager.instance = null;
        }
        eventBus.off(GameEvent.UI_CLOSE, this.onUIClose, this);
        eventBus.off(GameEvent.GOLD_CHANGED, this.refreshStatusBand, this);
        eventBus.off(GameEvent.EXP_GAINED, this.refreshStatusBand, this);
        eventBus.off(GameEvent.LEVEL_UP, this.refreshStatusBand, this);
    }

    /**
     * 刷新主界面右上角的信息牌。
     *
     * 信息牌节点来自 MainScene，系统组件由 GameManager 动态创建。把两者的绑定
     * 收口在 UIManager 中，可以避免 CurrencySystem/ExpSystem 反向依赖具体场景结构。
     */
    private refreshStatusBand(): void {
        const band = find('Canvas/bandLayer/band');
        const currency = CurrencySystem.getInstance();
        const expSystem = ExpSystem.getInstance();
        if (!band || !currency || !expSystem) return;

        const player = expSystem.getPlayerData();
        const ratio = player.expToNextLevel > 0
            ? Math.min(Math.max(player.currentExp / player.expToNextLevel, 0), 1)
            : 1;

        const setText = (nodeName: string, value: string): void => {
            const textNode = band.getChildByName(nodeName);
            const label = textNode?.getComponent(Label);
            const transform = textNode?.getComponent(UITransform);
            if (!textNode || !label || !transform) return;

            // 场景里旧标签只有 42px，拼接数值后会被 CLAMP 截断；运行时扩展到木牌安全区。
            transform.setContentSize(150, 22);
            textNode.setPosition(-1, textNode.position.y, textNode.position.z);
            label.horizontalAlign = Label.HorizontalAlign.LEFT;
            label.string = value;
        };

        setText('gold', `金币：${currency.gold}`);
        setText('level', `等级：${player.level}`);
        setText('exp', `经验：${player.currentExp}/${player.expToNextLevel}`);

        // 旧场景中的 ProgressBar 没有绑定 barSprite，直接使用填充精灵可稳定显示进度。
        const expProgress = band.getChildByName('exp_progress');
        const expSprite = expProgress?.getComponent(Sprite);
        if (expProgress && expSprite) {
            // 文本已显示精确值，进度条下移一行，避免再与经验数字重叠。
            expProgress.setPosition(0, -44, expProgress.position.z);
            expSprite.type = Sprite.Type.FILLED;
            expSprite.fillType = Sprite.FillType.HORIZONTAL;
            expSprite.fillStart = 0;
            expSprite.fillRange = ratio;
        }
    }

    /**
     * 统一播放面板关闭动画。
     *
     * 调用方必须先把 currentXxxPanel 置空，再进入这里。这样即使用户在关闭动画
     * 尚未结束时再次打开同类面板，旧动画回调也只会销毁旧节点，不会误伤新面板。
     */
    private destroyPanelWithAnimation(panel: Node, panelName: string): void {
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelClose(panel, () => {
                if (panel.isValid) panel.destroy();
            });
        } else if (panel.isValid) {
            panel.destroy();
        }
        console.log(`[UIManager] ${panelName}面板已关闭`);
    }

    /**
     * 处理UI关闭事件
     */
    private onUIClose(data: { panel: string }) {
        if (!data) return;
        switch (data.panel) {
            case 'shop': this.closeShopPanel(); break;
            case 'warehouse': this.closeWarehousePanel(); break;
            case 'save': this.closeSavePanel(); break;
            case 'friends': this.closeFriendsPanel(); break;
            case 'tutorial': this.closeTutorialPanel(); break;
        }
    }

    /**
     * 获取单例
     */
    public static getInstance(): UIManager {
        // 如果实例不存在，尝试自动创建
        if (!UIManager.instance) {
            UIManager.ensureInstance();
        }
        return UIManager.instance;
    }

    /**
     * 确保UIManager实例存在（自动创建）
     */
    public static ensureInstance(): boolean {
        if (UIManager.instance) {
            return true;
        }

        // 查找是否已有UIManager节点
        let uiManagerNode = find('Canvas/UIManager');
        
        if (!uiManagerNode) {
            console.log('[UIManager] 自动创建UIManager节点');
            
            // 获取Canvas
            const canvas = find('Canvas');
            if (!canvas) {
                console.warn('[UIManager] 找不到Canvas节点，无法创建UIManager');
                return false;
            }

            // 创建UIManager节点
            uiManagerNode = new Node('UIManager');
            uiManagerNode.layer = Layers.Enum.UI_2D;
            uiManagerNode.parent = canvas;

            // 添加UIManager组件
            uiManagerNode.addComponent(UIManager);
            
            console.log('[UIManager] UIManager节点创建完成');
        }

        return UIManager.instance !== null;
    }

    /**
     * 打开商店面板
     */
    public openShopPanel() {
        // 如果已经打开，则关闭
        if (this.currentShopPanel) {
            this.closeShopPanel();
            return;
        }

        // 关闭仓库面板（如果打开的话）
        if (this.currentWarehousePanel) {
            this.closeWarehousePanel();
        }

        // 获取Canvas作为parent
        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[UIManager] 找不到Canvas节点');
            return;
        }

        // 创建简单商店面板 - 放在Canvas下确保正确显示
        this.currentShopPanel = new Node('ShopPanel');
        this.currentShopPanel.layer = Layers.Enum.UI_2D;
        this.currentShopPanel.parent = canvas;
        // 设置面板位置在屏幕中心
        this.currentShopPanel.setPosition(0, 0, 100);

        const panel = this.currentShopPanel.addComponent(UISimplePanel);
        panel.initShop();

        // 播放面板弹入动画
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelOpen(this.currentShopPanel);
        }

        console.log('[UIManager] 商店面板已打开');
        eventBus.emit(GameEvent.UI_OPEN, { panel: 'shop' });
    }

    /**
     * 关闭商店面板
     */
    public closeShopPanel() {
        const panel = this.currentShopPanel;
        if (panel) {
            // 先清引用再异步销毁，避免快速连点造成生命周期竞争。
            this.currentShopPanel = null;
            this.destroyPanelWithAnimation(panel, '商店');
        }
    }

    /**
     * 打开仓库面板
     */
    public openWarehousePanel() {
        // 如果已经打开，则关闭
        if (this.currentWarehousePanel) {
            this.closeWarehousePanel();
            return;
        }

        // 关闭商店面板（如果打开的话）
        if (this.currentShopPanel) {
            this.closeShopPanel();
        }

        // 获取Canvas作为parent
        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[UIManager] 找不到Canvas节点');
            return;
        }

        // 创建简单仓库面板 - 放在Canvas下确保正确显示
        this.currentWarehousePanel = new Node('WarehousePanel');
        this.currentWarehousePanel.layer = Layers.Enum.UI_2D;
        this.currentWarehousePanel.parent = canvas;
        // 设置面板位置在屏幕中心
        this.currentWarehousePanel.setPosition(0, 0, 100);

        const panel = this.currentWarehousePanel.addComponent(UISimplePanel);
        panel.initWarehouse();

        // 播放面板弹入动画
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelOpen(this.currentWarehousePanel);
        }

        console.log('[UIManager] 仓库面板已打开');
        eventBus.emit(GameEvent.UI_OPEN, { panel: 'warehouse' });
    }

    /**
     * 关闭仓库面板
     */
    public closeWarehousePanel() {
        const panel = this.currentWarehousePanel;
        if (panel) {
            this.currentWarehousePanel = null;
            this.destroyPanelWithAnimation(panel, '仓库');
        }
    }

    /**
     * 显示提示信息
     */
    public showToast(message: string) {
        console.log(`[Toast] ${message}`);
        // 可以在这里实现Toast提示
    }

    // ==================== 存档UI ====================

    /**
     * 打开存档面板
     */
    public openSavePanel() {
        if (this.currentSavePanel) {
            this.closeSavePanel();
            return;
        }

        // 关闭其他面板
        if (this.currentShopPanel) this.closeShopPanel();
        if (this.currentWarehousePanel) this.closeWarehousePanel();

        const canvas = find('Canvas');
        if (!canvas) return;

        this.currentSavePanel = new Node('SavePanel');
        this.currentSavePanel.layer = Layers.Enum.UI_2D;
        this.currentSavePanel.parent = canvas;
        this.currentSavePanel.setPosition(0, 0, 100);

        const panel = this.currentSavePanel.addComponent(UISimplePanel);
        panel.initSavePanel();

        // 播放面板弹入动画
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelOpen(this.currentSavePanel);
        }

        console.log('[UIManager] 存档面板已打开');
    }

    /**
     * 关闭存档面板
     */
    public closeSavePanel() {
        const panel = this.currentSavePanel;
        if (panel) {
            this.currentSavePanel = null;
            this.destroyPanelWithAnimation(panel, '存档');
        }
    }

    // ==================== 好友面板 ====================

    /**
     * 打开好友面板
     */
    public openFriendsPanel() {
        if (this.currentFriendsPanel) {
            this.closeFriendsPanel();
            return;
        }

        // 关闭其他面板
        if (this.currentShopPanel) this.closeShopPanel();
        if (this.currentWarehousePanel) this.closeWarehousePanel();

        const canvas = find('Canvas');
        if (!canvas) return;

        this.currentFriendsPanel = new Node('FriendsPanel');
        this.currentFriendsPanel.layer = Layers.Enum.UI_2D;
        this.currentFriendsPanel.parent = canvas;
        this.currentFriendsPanel.setPosition(0, 0, 100);

        const panel = this.currentFriendsPanel.addComponent(UIFriendsPanel);
        this.currentFriendsPanel.active = true;

        // 播放面板弹入动画
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelOpen(this.currentFriendsPanel);
        }

        console.log('[UIManager] 好友面板已打开');
        eventBus.emit(GameEvent.UI_OPEN, { panel: 'friends' });
    }

    /**
     * 关闭好友面板
     */
    public closeFriendsPanel() {
        const panel = this.currentFriendsPanel;
        if (panel) {
            this.currentFriendsPanel = null;
            this.destroyPanelWithAnimation(panel, '好友');
        }
    }

    // ==================== 新手引导面板 ====================

    /**
     * 打开新手引导面板
     */
    public openTutorialPanel() {
        if (this.currentTutorialPanel) {
            this.closeTutorialPanel();
            return;
        }

        const canvas = find('Canvas');
        if (!canvas) return;

        this.currentTutorialPanel = new Node('TutorialPanel');
        this.currentTutorialPanel.layer = Layers.Enum.UI_2D;
        this.currentTutorialPanel.parent = canvas;
        this.currentTutorialPanel.setPosition(0, 0, 100);

        this.currentTutorialPanel.addComponent(UITutorial);
        this.currentTutorialPanel.active = true;

        // 播放面板弹入动画
        const animSystem = AnimationSystem.getInstance();
        if (animSystem) {
            animSystem.playPanelOpen(this.currentTutorialPanel);
        }

        console.log('[UIManager] 新手引导面板已打开');
        eventBus.emit(GameEvent.UI_OPEN, { panel: 'tutorial' });
    }

    /**
     * 关闭新手引导面板
     */
    public closeTutorialPanel() {
        const panel = this.currentTutorialPanel;
        if (panel) {
            this.currentTutorialPanel = null;
            this.destroyPanelWithAnimation(panel, '新手引导');
        }
    }
}
