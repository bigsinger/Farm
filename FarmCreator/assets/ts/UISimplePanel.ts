import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Layers,
    Layout,
    Mask,
    Node,
    resources,
    ScrollView,
    Size,
    Sprite,
    SpriteAtlas,
    SpriteFrame,
    tween,
    UITransform,
    UIOpacity,
    Vec3,
} from 'cc';
import { CurrencySystem } from './CurrencySystem';
import { eventBus, GameEvent } from './EventBus';
import { ExpSystem } from './ExpSystem';
import { FarmMarketOrder, MarketOrderManager } from './MarketOrderManager';
import { SaveData, SaveManager } from './SaveManager';
import { ShopItem, ShopManager } from './ShopManager';
import { WarehouseItem, WarehouseManager } from './WarehouseManager';

const { ccclass } = _decorator;

type PanelMode = 'shop' | 'warehouse' | 'save';
type ShopFilter = 'unlocked' | 'locked' | 'all';
type WarehouseTab = 'stock' | 'orders';
type WarehouseSort = 'default' | 'count' | 'value';
type DetailMode = 'shop' | 'warehouse';

/**
 * 农场经营面板。
 *
 * 商店和仓库共用一套明亮木质框架、羊皮纸内容区和作物插画，
 * 避免依赖 Android 上不稳定的彩色 Emoji 字体。
 *
 * 教学提示：
 * - 面板主体由代码动态创建，适合观察 Node、UITransform、Layout 的组合方式；
 * - 数据只从各 Manager 读取，操作完成后再通过 EventBus 刷新视图；
 * - 作物与农场图标来自 SpriteAtlas，界面层不保存重复纹理。
 */
@ccclass('UISimplePanel')
export class UISimplePanel extends Component {
    private readonly PANEL_W = 900;
    private readonly PANEL_H = 650;
    private readonly CONTENT_W = 842;
    private readonly VIEW_H = 400;
    private readonly CARD_W = 188;
    private readonly CARD_H = 154;

    // 作物图标必须落在标题和底部信息之间的“安全区”内。
    // 集中维护这些尺寸，后续调整卡片高度时不会遗漏某一种面板。
    private readonly CARD_CROP_W = 104;
    private readonly CARD_CROP_H = 62;
    private readonly ORDER_CROP_W = 82;
    private readonly ORDER_CROP_H = 58;
    private readonly DETAIL_CROP_W = 112;
    private readonly DETAIL_CROP_H = 72;

    private readonly COLOR_OVERLAY = new Color(15, 38, 24, 172);
    private readonly COLOR_WOOD_DARK = new Color(92, 49, 27, 255);
    private readonly COLOR_WOOD = new Color(139, 79, 39, 255);
    private readonly COLOR_WOOD_LIGHT = new Color(187, 119, 63, 255);
    private readonly COLOR_PARCHMENT = new Color(250, 235, 190, 255);
    private readonly COLOR_PAPER = new Color(255, 248, 220, 255);
    private readonly COLOR_PAPER_DARK = new Color(235, 211, 158, 255);
    private readonly COLOR_GREEN = new Color(74, 132, 57, 255);
    private readonly COLOR_GREEN_DARK = new Color(47, 94, 42, 255);
    private readonly COLOR_GREEN_LIGHT = new Color(124, 174, 75, 255);
    private readonly COLOR_GOLD = new Color(242, 174, 55, 255);
    private readonly COLOR_RED = new Color(177, 72, 50, 255);
    private readonly COLOR_INK = new Color(82, 55, 35, 255);
    private readonly COLOR_MUTED = new Color(130, 105, 75, 255);

    private mode: PanelMode = 'shop';
    private shopFilter: ShopFilter = 'unlocked';
    private warehouseTab: WarehouseTab = 'stock';
    private warehouseSort: WarehouseSort = 'default';

    private panelBody: Node | null = null;
    private titleLabel: Label | null = null;
    private subtitleLabel: Label | null = null;
    private goldLabel: Label | null = null;
    private levelLabel: Label | null = null;
    private summaryLabel: Label | null = null;
    private infoLabel: Label | null = null;
    private headerIcon: Sprite | null = null;
    private modeNavNode: Node | null = null;
    private sortNode: Node | null = null;
    private contentNode: Node | null = null;
    private contentLayout: Layout | null = null;
    private scrollView: ScrollView | null = null;

    private cropAtlas: SpriteAtlas | null = null;
    private farmUiAtlas: SpriteAtlas | null = null;
    /** 缓存“作物编号 → 成熟阶段帧”，避免每次列表刷新都遍历图集。 */
    private cropFrameCache = new Map<number, SpriteFrame | null>();
    private shopRetryCount = 0;

    private detailPopup: Node | null = null;
    private detailQuantity = 1;
    private detailMaxQuantity = 1;
    private detailUnitPrice = 0;
    private detailQuantityLabel: Label | null = null;
    private detailTotalLabel: Label | null = null;

    onLoad(): void {
        this.createBaseUI();
        this.registerEvents();
        this.loadAtlases();
        this.schedule(this.updateSummary, 1);
    }

    onDestroy(): void {
        this.unscheduleAllCallbacks();
        eventBus.off(GameEvent.GOLD_CHANGED, this.onGoldChanged, this);
        eventBus.off(GameEvent.LEVEL_UP, this.onLevelChanged, this);
        eventBus.off(GameEvent.SHOP_ITEM_BOUGHT, this.onShopChanged, this);
        eventBus.off(GameEvent.SHOP_UNLOCKED, this.onShopChanged, this);
        eventBus.off(GameEvent.WAREHOUSE_CHANGED, this.onWarehouseChanged, this);
        eventBus.off(GameEvent.MARKET_ORDER_COMPLETED, this.onOrdersChanged, this);
        eventBus.off(GameEvent.MARKET_ORDERS_REFRESHED, this.onOrdersChanged, this);
    }

    public openAsShop(): void {
        this.initShop();
    }

    public openAsWarehouse(): void {
        this.initWarehouse();
    }

    public openAsSavePanel(): void {
        this.initSavePanel();
    }

    public initShop(): void {
        this.mode = 'shop';
        this.shopRetryCount = 0;
        this.refresh();
    }

    public initWarehouse(): void {
        this.mode = 'warehouse';
        this.refresh();
    }

    public initSavePanel(): void {
        this.mode = 'save';
        this.refresh();
    }

    private registerEvents(): void {
        eventBus.on(GameEvent.GOLD_CHANGED, this.onGoldChanged, this);
        eventBus.on(GameEvent.LEVEL_UP, this.onLevelChanged, this);
        eventBus.on(GameEvent.SHOP_ITEM_BOUGHT, this.onShopChanged, this);
        eventBus.on(GameEvent.SHOP_UNLOCKED, this.onShopChanged, this);
        eventBus.on(GameEvent.WAREHOUSE_CHANGED, this.onWarehouseChanged, this);
        eventBus.on(GameEvent.MARKET_ORDER_COMPLETED, this.onOrdersChanged, this);
        eventBus.on(GameEvent.MARKET_ORDERS_REFRESHED, this.onOrdersChanged, this);
    }

    private loadAtlases(): void {
        resources.load('crop/crop', SpriteAtlas, (error, atlas) => {
            if (error) {
                console.warn('[UISimplePanel] 作物图集加载失败:', error);
                return;
            }
            if (!this.node.isValid) return;
            this.cropAtlas = atlas;
            this.cropFrameCache.clear();
            this.refreshContent();
        });

        resources.load('farmUI/farm_ui_res', SpriteAtlas, (error, atlas) => {
            if (error) {
                console.warn('[UISimplePanel] 农场 UI 图集加载失败:', error);
                return;
            }
            if (!this.node.isValid) return;
            this.farmUiAtlas = atlas;
            this.updateHeaderIcon();
        });
    }

    private createBaseUI(): void {
        const rootTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootTransform.setContentSize(1024, 768);

        const overlay = this.makeRoundedNode('Overlay', 2048, 1536, this.COLOR_OVERLAY, 0, 0, 0, 0);
        overlay.parent = this.node;
        overlay.on(Node.EventType.TOUCH_END, (event: any) => {
            event.propagationStopped = true;
            this.close();
        }, this);

        const shadow = this.makeRoundedNode(
            'PanelShadow',
            this.PANEL_W + 12,
            this.PANEL_H + 12,
            new Color(31, 24, 17, 125),
            7,
            -9,
            1,
            24,
        );
        shadow.parent = this.node;

        const frame = this.makeRoundedNode(
            'PanelFrame',
            this.PANEL_W,
            this.PANEL_H,
            this.COLOR_WOOD_DARK,
            0,
            0,
            2,
            22,
            new Color(70, 35, 20, 255),
            3,
        );
        frame.parent = this.node;
        frame.on(Node.EventType.TOUCH_START, (event: any) => {
            event.propagationStopped = true;
        }, this);
        frame.on(Node.EventType.TOUCH_END, (event: any) => {
            event.propagationStopped = true;
        }, this);
        this.panelBody = frame;

        const paper = this.makeRoundedNode(
            'Paper',
            this.PANEL_W - 24,
            this.PANEL_H - 24,
            this.COLOR_PARCHMENT,
            0,
            -3,
            3,
            17,
            this.COLOR_WOOD_LIGHT,
            3,
        );
        paper.parent = frame;

        const header = this.makeRoundedNode(
            'Header',
            this.PANEL_W - 42,
            90,
            this.COLOR_WOOD,
            0,
            this.PANEL_H / 2 - 65,
            4,
            16,
            this.COLOR_WOOD_DARK,
            2,
        );
        header.parent = frame;
        this.addLeafDecoration(header, -390, 0, false);
        this.addLeafDecoration(header, 390, 0, true);

        const iconNode = new Node('HeaderIcon');
        iconNode.layer = Layers.Enum.UI_2D;
        iconNode.addComponent(UITransform).setContentSize(56, 56);
        iconNode.setPosition(-384, 0, 2);
        iconNode.parent = header;
        this.headerIcon = iconNode.addComponent(Sprite);
        this.headerIcon.sizeMode = Sprite.SizeMode.CUSTOM;

        const titleNode = this.makeLabel('Title', '种子商店', 34, new Color(255, 246, 210, 255), 340, 44);
        titleNode.setPosition(-180, 12, 2);
        titleNode.parent = header;
        const title = titleNode.getComponent(Label)!;
        title.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.isBold = true;
        this.titleLabel = title;

        const subtitleNode = this.makeLabel('Subtitle', '挑选种子，让农场四季丰收', 16, new Color(239, 216, 171, 255), 380, 28);
        subtitleNode.setPosition(-160, -23, 2);
        subtitleNode.parent = header;
        const subtitle = subtitleNode.getComponent(Label)!;
        subtitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.subtitleLabel = subtitle;

        const statusPill = this.makeRoundedNode(
            'StatusPill',
            248,
            54,
            new Color(73, 45, 28, 230),
            238,
            0,
            2,
            26,
            new Color(219, 159, 80, 255),
            2,
        );
        statusPill.parent = header;

        const goldNode = this.makeLabel('Gold', '金币 0', 21, new Color(255, 205, 79, 255), 145, 32);
        goldNode.setPosition(-34, 0, 2);
        goldNode.parent = statusPill;
        this.goldLabel = goldNode.getComponent(Label);

        const levelNode = this.makeLabel('Level', 'Lv.1', 18, new Color(220, 244, 193, 255), 78, 32);
        levelNode.setPosition(78, 0, 2);
        levelNode.parent = statusPill;
        this.levelLabel = levelNode.getComponent(Label);

        const closeButton = this.makeButton(
            'CloseButton',
            '关闭',
            64,
            38,
            this.COLOR_RED,
            () => this.close(),
            new Color(255, 245, 224, 255),
        );
        closeButton.setPosition(this.PANEL_W / 2 - 61, this.PANEL_H / 2 - 48, 10);
        closeButton.parent = frame;

        this.modeNavNode = new Node('ModeNavigation');
        this.modeNavNode.layer = Layers.Enum.UI_2D;
        this.modeNavNode.addComponent(UITransform).setContentSize(this.CONTENT_W, 44);
        this.modeNavNode.setPosition(0, 194, 5);
        this.modeNavNode.parent = frame;

        this.sortNode = new Node('SortAndSummary');
        this.sortNode.layer = Layers.Enum.UI_2D;
        this.sortNode.addComponent(UITransform).setContentSize(this.CONTENT_W, 38);
        this.sortNode.setPosition(0, 151, 5);
        this.sortNode.parent = frame;

        const summaryNode = this.makeLabel('Summary', '', 16, this.COLOR_MUTED, 370, 30);
        summaryNode.setPosition(-223, 0, 2);
        summaryNode.parent = this.sortNode;
        const summary = summaryNode.getComponent(Label)!;
        summary.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.summaryLabel = summary;

        this.createScrollView(frame);

        const footer = this.makeRoundedNode(
            'Footer',
            this.CONTENT_W,
            42,
            new Color(237, 213, 161, 245),
            0,
            -286,
            5,
            12,
            new Color(205, 168, 106, 255),
            1,
        );
        footer.parent = frame;
        const infoNode = this.makeLabel('Info', '点击卡片查看详情', 17, this.COLOR_INK, this.CONTENT_W - 30, 30);
        infoNode.parent = footer;
        this.infoLabel = infoNode.getComponent(Label);

        frame.setScale(new Vec3(0.86, 0.86, 1));
        const opacity = frame.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(frame).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        tween(opacity).to(0.18, { opacity: 255 }).start();
    }

    private createScrollView(parent: Node): void {
        const viewport = this.makeRoundedNode(
            'Viewport',
            this.CONTENT_W,
            this.VIEW_H,
            this.COLOR_PAPER,
            0,
            -61,
            5,
            12,
            this.COLOR_PAPER_DARK,
            2,
        );
        viewport.parent = parent;
        viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;

        this.scrollView = viewport.addComponent(ScrollView);
        this.scrollView.horizontal = false;
        this.scrollView.vertical = true;
        this.scrollView.inertia = true;
        this.scrollView.elastic = true;
        this.scrollView.brake = 0.72;
        this.scrollView.bounceDuration = 0.25;
        this.scrollView.cancelInnerEvents = true;

        const content = new Node('Content');
        content.layer = Layers.Enum.UI_2D;
        const transform = content.addComponent(UITransform);
        transform.setContentSize(this.CONTENT_W - 12, this.VIEW_H);
        transform.setAnchorPoint(0.5, 1);
        content.setPosition(0, this.VIEW_H / 2, 1);
        content.parent = viewport;

        this.contentLayout = content.addComponent(Layout);
        this.contentNode = content;
        this.scrollView.content = content;
        this.configureGrid(false);
    }

    private refresh(): void {
        if (!this.panelBody) return;
        this.closeDetailPopup();
        this.updateHeader();
        this.rebuildNavigation();
        this.refreshContent();
        this.updateSummary();
    }

    private updateHeader(): void {
        if (!this.titleLabel || !this.subtitleLabel) return;

        if (this.mode === 'shop') {
            this.titleLabel.string = '种子商店';
            this.subtitleLabel.string = '挑选种子，让农场四季丰收';
        } else if (this.mode === 'warehouse') {
            this.titleLabel.string = this.warehouseTab === 'orders' ? '农场订单' : '丰收仓库';
            this.subtitleLabel.string = this.warehouseTab === 'orders'
                ? '按时交付订单，获得额外金币和经验'
                : '整理收成、查看价值并快速出售';
        } else {
            this.titleLabel.string = '农场存档';
            this.subtitleLabel.string = '保存每一次辛勤经营的成果';
        }

        this.updateCurrencyDisplay();
        this.updateHeaderIcon();
    }

    private updateHeaderIcon(): void {
        if (!this.headerIcon || !this.farmUiAtlas) return;
        const frameName = this.mode === 'warehouse' ? 'farm_ui_warehouse' : 'farm_ui_shop';
        this.headerIcon.spriteFrame = this.farmUiAtlas.getSpriteFrame(frameName)
            || this.farmUiAtlas.getSpriteFrame(`${frameName}.png`);
        this.headerIcon.node.active = this.mode !== 'save';
    }

    private updateCurrencyDisplay(): void {
        if (this.goldLabel) {
            this.goldLabel.string = `金币 ${CurrencySystem.getInstance()?.gold || 0}`;
        }
        if (this.levelLabel) {
            this.levelLabel.string = `Lv.${ExpSystem.getInstance()?.getLevel() || 1}`;
        }
    }

    private rebuildNavigation(): void {
        if (!this.modeNavNode || !this.sortNode) return;
        this.modeNavNode.removeAllChildren();

        for (const child of [...this.sortNode.children]) {
            if (child.name !== 'Summary') child.destroy();
        }

        if (this.mode === 'shop') {
            this.createChoiceButtons<ShopFilter>(
                this.modeNavNode,
                [
                    { key: 'unlocked', label: '可购买' },
                    { key: 'locked', label: '待解锁' },
                    { key: 'all', label: '全部种子' },
                ],
                this.shopFilter,
                (key) => {
                    this.shopFilter = key;
                    this.rebuildNavigation();
                    this.refreshShopContent();
                },
                124,
            );
        } else if (this.mode === 'warehouse') {
            this.createChoiceButtons<WarehouseTab>(
                this.modeNavNode,
                [
                    { key: 'stock', label: '仓库库存' },
                    { key: 'orders', label: '订单交付' },
                ],
                this.warehouseTab,
                (key) => {
                    this.warehouseTab = key;
                    this.updateHeader();
                    this.rebuildNavigation();
                    this.refreshWarehouseContent();
                    this.updateSummary();
                },
                150,
            );

            if (this.warehouseTab === 'stock') {
                const sortHost = new Node('SortButtons');
                sortHost.layer = Layers.Enum.UI_2D;
                sortHost.addComponent(UITransform).setContentSize(360, 34);
                sortHost.setPosition(235, 0, 2);
                sortHost.parent = this.sortNode;
                this.createChoiceButtons<WarehouseSort>(
                    sortHost,
                    [
                        { key: 'default', label: '默认' },
                        { key: 'count', label: '数量' },
                        { key: 'value', label: '价值' },
                    ],
                    this.warehouseSort,
                    (key) => {
                        this.warehouseSort = key;
                        this.rebuildNavigation();
                        this.refreshWarehouseStock();
                    },
                    84,
                    30,
                    14,
                );
            }
        }
    }

    private createChoiceButtons<T extends string>(
        parent: Node,
        options: Array<{ key: T; label: string }>,
        selected: T,
        onSelect: (key: T) => void,
        width: number,
        height = 38,
        fontSize = 17,
    ): void {
        const gap = 10;
        const totalWidth = options.length * width + (options.length - 1) * gap;
        options.forEach((option, index) => {
            const active = option.key === selected;
            const button = this.makeButton(
                `Choice_${option.key}`,
                option.label,
                width,
                height,
                active ? this.COLOR_GREEN : this.COLOR_PAPER_DARK,
                () => onSelect(option.key),
                active ? Color.WHITE : this.COLOR_INK,
                active ? this.COLOR_GREEN_DARK : new Color(196, 157, 99, 255),
                fontSize,
            );
            button.setPosition(-totalWidth / 2 + width / 2 + index * (width + gap), 0, 1);
            button.parent = parent;
        });
    }

    private refreshContent(): void {
        if (!this.contentNode) return;
        if (this.mode === 'shop') {
            this.refreshShopContent();
        } else if (this.mode === 'warehouse') {
            this.refreshWarehouseContent();
        } else {
            this.refreshSaveContent();
        }
    }

    private refreshShopContent(): void {
        const shop = ShopManager.getInstance();
        if (!shop || !shop.isDataReady()) {
            this.clearContent(false);
            this.createEmptyState('种子正在上架，请稍候…', '商店会在作物数据加载完成后自动刷新');
            if (this.shopRetryCount < 12) {
                this.shopRetryCount++;
                this.scheduleOnce(() => this.refreshShopContent(), 0.35);
            } else {
                this.showInfo('种子数据加载超时，请重新打开商店');
            }
            return;
        }

        this.shopRetryCount = 0;
        let items = shop.getAllItems();
        if (this.shopFilter === 'unlocked') items = items.filter(item => item.unlocked);
        if (this.shopFilter === 'locked') items = items.filter(item => !item.unlocked);
        items.sort((a, b) => a.unlockLevel - b.unlockLevel || a.seedPrice - b.seedPrice);

        this.clearContent(false);
        if (items.length === 0) {
            this.createEmptyState(
                this.shopFilter === 'locked' ? '全部种子都已解锁' : '当前分类没有种子',
                '继续经营农场，新的种子会逐步开放',
            );
            return;
        }

        const gold = CurrencySystem.getInstance()?.gold || 0;
        for (const item of items) {
            this.createShopCard(item, gold);
        }
        this.finishLayout();
        this.showInfo('点击种子卡片可选择购买数量');
    }

    private createShopCard(item: ShopItem, gold: number): void {
        if (!this.contentNode) return;
        const locked = !item.unlocked;
        const affordable = !locked && gold >= item.seedPrice;
        const card = this.createItemCard(item.cropId, locked, item.cropName);
        card.parent = this.contentNode;

        const priceColor = affordable ? this.COLOR_GOLD : this.COLOR_RED;
        const price = this.makeRoundedNode(
            'Price',
            78,
            28,
            new Color(priceColor.r, priceColor.g, priceColor.b, 235),
            -48,
            -54,
            3,
            12,
        );
        price.parent = card;
        const priceLabel = this.makeLabel('PriceLabel', locked ? `Lv.${item.unlockLevel}` : `${item.seedPrice} 金币`, 14, Color.WHITE, 74, 22);
        priceLabel.parent = price;

        const seedCount = ShopManager.getInstance()?.getSeedCount(item.cropId) || 0;
        const stock = this.makeLabel(
            'SeedStock',
            locked ? '尚未解锁' : `已有种子 ${seedCount}`,
            13,
            locked ? this.COLOR_MUTED : this.COLOR_GREEN_DARK,
            92,
            24,
        );
        stock.setPosition(43, -54, 3);
        stock.parent = card;

        if (locked) {
            const lockMask = this.makeRoundedNode(
                'LockedMask',
                this.CARD_W - 8,
                this.CARD_H - 8,
                new Color(91, 75, 58, 120),
                0,
                0,
                5,
                12,
            );
            lockMask.parent = card;
            const lockText = this.makeLabel('LockedText', `达到 Lv.${item.unlockLevel} 解锁`, 17, Color.WHITE, 160, 32);
            lockText.setPosition(0, -4, 6);
            lockText.parent = lockMask;
        }

        this.bindCardTap(card, () => {
            if (locked) {
                this.showInfo(`${item.cropName}需要达到 Lv.${item.unlockLevel} 才能购买`);
                return;
            }
            this.showDetailPopup(item, 'shop');
        });
    }

    private refreshWarehouseContent(): void {
        if (this.warehouseTab === 'orders') {
            this.refreshOrderContent();
        } else {
            this.refreshWarehouseStock();
        }
    }

    private refreshWarehouseStock(): void {
        const warehouse = WarehouseManager.getInstance();
        this.clearContent(false);
        if (!warehouse) {
            this.createEmptyState('仓库正在整理', '请稍候再试');
            return;
        }

        const items = warehouse.getAllItems();
        if (this.warehouseSort === 'count') {
            items.sort((a, b) => b.count - a.count);
        } else if (this.warehouseSort === 'value') {
            items.sort((a, b) => (b.count * b.sellPrice) - (a.count * a.sellPrice));
        } else {
            items.sort((a, b) => a.cropId - b.cropId);
        }

        if (items.length === 0) {
            this.createEmptyState('仓库还是空的', '成熟后点击作物收获，成果会存放在这里');
            this.showInfo('先去农田收获一些作物吧');
            return;
        }

        for (const item of items) {
            this.createWarehouseCard(item);
        }
        this.finishLayout();
        this.showInfo('点击库存卡片可批量出售作物');
    }

    private createWarehouseCard(item: WarehouseItem): void {
        if (!this.contentNode) return;
        const card = this.createItemCard(item.cropId, false, item.cropName);
        card.parent = this.contentNode;

        const quantity = this.makeRoundedNode('Quantity', 72, 28, this.COLOR_GREEN, -51, -54, 3, 12);
        quantity.parent = card;
        const quantityLabel = this.makeLabel('QuantityLabel', `库存 ${item.count}`, 14, Color.WHITE, 68, 22);
        quantityLabel.parent = quantity;

        const value = this.makeLabel(
            'Value',
            `${item.sellPrice} 金币/份`,
            13,
            this.COLOR_WOOD_DARK,
            100,
            24,
        );
        value.setPosition(38, -54, 3);
        value.parent = card;

        this.bindCardTap(card, () => this.showDetailPopup(item, 'warehouse'));
    }

    private refreshOrderContent(): void {
        const manager = MarketOrderManager.getInstance();
        this.clearContent(true);
        if (!manager) {
            this.createEmptyState('订单板正在准备', '请稍候再试');
            return;
        }

        const orders = manager.getActiveOrders();
        if (orders.length === 0) {
            this.createEmptyState('今日订单已完成', '新的订单会在刷新时间到达后出现');
            this.showInfo('所有订单都交付完成了，干得漂亮');
            return;
        }

        for (const order of orders) {
            this.createOrderCard(order);
        }
        this.finishLayout();
        this.showInfo('订单奖励高于直接出售，备齐数量后即可交付');
    }

    private createOrderCard(order: FarmMarketOrder): void {
        if (!this.contentNode) return;
        const warehouse = WarehouseManager.getInstance();
        const owned = warehouse?.getItemCount(order.cropId) || 0;
        const ready = owned >= order.requiredCount;

        const card = this.makeRoundedNode(
            `Order_${order.id}`,
            this.CONTENT_W - 34,
            104,
            this.COLOR_PAPER,
            0,
            0,
            1,
            14,
            ready ? this.COLOR_GREEN_LIGHT : new Color(207, 169, 109, 255),
            2,
        );
        card.parent = this.contentNode;
        this.createCropVisual(
            card,
            order.cropId,
            false,
            -337,
            0,
            this.ORDER_CROP_W,
            this.ORDER_CROP_H,
        );

        const title = this.makeLabel('OrderTitle', `${order.cropName}采购单`, 21, this.COLOR_INK, 220, 30);
        title.setPosition(-220, 23, 2);
        title.parent = card;
        title.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;

        const need = this.makeLabel(
            'OrderNeed',
            `需要 ${order.requiredCount} 份  ·  仓库 ${owned} 份`,
            16,
            ready ? this.COLOR_GREEN_DARK : this.COLOR_RED,
            265,
            28,
        );
        need.setPosition(-198, -16, 2);
        need.parent = card;
        need.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;

        const reward = this.makeRoundedNode(
            'Reward',
            210,
            58,
            new Color(247, 222, 154, 255),
            110,
            0,
            2,
            12,
            this.COLOR_GOLD,
            1,
        );
        reward.parent = card;
        const rewardGold = this.makeLabel('RewardGold', `奖励 ${order.rewardGold} 金币`, 17, this.COLOR_WOOD_DARK, 195, 26);
        rewardGold.setPosition(0, 13, 2);
        rewardGold.parent = reward;
        const rewardExp = this.makeLabel('RewardExp', `经验 +${order.rewardExp}`, 14, this.COLOR_GREEN_DARK, 195, 22);
        rewardExp.setPosition(0, -14, 2);
        rewardExp.parent = reward;

        const deliver = this.makeButton(
            'Deliver',
            ready ? '交付订单' : `还差 ${order.requiredCount - owned}`,
            112,
            46,
            ready ? this.COLOR_GREEN : new Color(161, 147, 120, 255),
            () => {
                if (!ready) {
                    this.showInfo(`${order.cropName}还差 ${order.requiredCount - owned} 份`);
                    return;
                }
                const result = managerCompleteOrder(order.id);
                this.showInfo(result.message);
                this.updateCurrencyDisplay();
                this.refreshOrderContent();
                this.updateSummary();
            },
            Color.WHITE,
            ready ? this.COLOR_GREEN_DARK : new Color(121, 109, 90, 255),
            17,
        );
        deliver.setPosition(337, 0, 3);
        deliver.parent = card;

        function managerCompleteOrder(orderId: string): { success: boolean; message: string } {
            return MarketOrderManager.getInstance()?.completeOrder(orderId)
                || { success: false, message: '订单系统未就绪' };
        }
    }

    private refreshSaveContent(): void {
        const saveManager = SaveManager.getInstance();
        this.clearContent(true);
        if (!saveManager) {
            this.createEmptyState('存档系统尚未就绪', '请稍候再试');
            return;
        }

        for (let slot = 0; slot < 3; slot++) {
            this.createSaveCard(saveManager, slot, saveManager.getSlotInfo(slot));
        }
        this.finishLayout();
        this.showInfo('建议在重要操作后手动保存一次进度');
    }

    private createSaveCard(saveManager: SaveManager, slot: number, data: SaveData | null): void {
        if (!this.contentNode) return;
        const hasData = data !== null;
        const card = this.makeRoundedNode(
            `SaveSlot_${slot}`,
            this.CONTENT_W - 34,
            104,
            this.COLOR_PAPER,
            0,
            0,
            1,
            14,
            hasData ? this.COLOR_GREEN_LIGHT : new Color(207, 169, 109, 255),
            2,
        );
        card.parent = this.contentNode;

        const badge = this.makeRoundedNode(
            'SlotBadge',
            86,
            68,
            hasData ? this.COLOR_GREEN : this.COLOR_WOOD_LIGHT,
            -344,
            0,
            2,
            14,
        );
        badge.parent = card;
        const badgeText = this.makeLabel('SlotText', `存档 ${slot + 1}`, 18, Color.WHITE, 80, 28);
        badgeText.parent = badge;

        const title = this.makeLabel(
            'SaveTitle',
            hasData ? data!.playerName : '空存档位',
            21,
            this.COLOR_INK,
            210,
            30,
        );
        title.setPosition(-230, 22, 2);
        title.parent = card;
        title.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;

        const description = hasData
            ? `第 ${data!.gameDays} 天  ·  ${this.formatPlayTime(data!.totalPlayTime)}  ·  ${new Date(data!.saveTime).toLocaleString()}`
            : '保存后会在这里显示经营进度';
        const detail = this.makeLabel('SaveDetail', description, 14, this.COLOR_MUTED, 430, 28);
        detail.setPosition(-120, -19, 2);
        detail.parent = card;
        detail.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;

        const saveButton = this.makeButton(
            'Save',
            hasData ? '覆盖保存' : '保存',
            96,
            42,
            this.COLOR_GREEN,
            async () => {
                const ok = await saveManager.save(slot);
                this.showInfo(ok ? `已保存到存档 ${slot + 1}` : '保存失败，请重试');
                this.refreshSaveContent();
            },
            Color.WHITE,
            this.COLOR_GREEN_DARK,
            16,
        );
        saveButton.setPosition(262, 0, 3);
        saveButton.parent = card;

        if (hasData) {
            const loadButton = this.makeButton(
                'Load',
                '读取',
                78,
                42,
                this.COLOR_WOOD_LIGHT,
                async () => {
                    const ok = await saveManager.load(slot);
                    this.showInfo(ok ? `已读取存档 ${slot + 1}` : '读取失败');
                    if (ok) this.scheduleOnce(() => this.close(), 0.35);
                },
                Color.WHITE,
                this.COLOR_WOOD,
                16,
            );
            loadButton.setPosition(360, 0, 3);
            loadButton.parent = card;
        }
    }

    private clearContent(verticalList: boolean): void {
        if (!this.contentNode) return;
        this.contentNode.removeAllChildren();
        this.configureGrid(verticalList);
        this.scrollView?.stopAutoScroll();
    }

    private configureGrid(verticalList: boolean): void {
        if (!this.contentLayout) return;
        const layout = this.contentLayout;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 14;
        layout.paddingBottom = 14;
        layout.paddingLeft = 14;
        layout.paddingRight = 14;
        layout.spacingX = 12;
        layout.spacingY = 11;

        if (verticalList) {
            layout.type = Layout.Type.VERTICAL;
            layout.cellSize = new Size(this.CONTENT_W - 34, 104);
        } else {
            layout.type = Layout.Type.GRID;
            layout.startAxis = Layout.AxisDirection.HORIZONTAL;
            layout.constraint = Layout.Constraint.FIXED_COL;
            layout.constraintNum = 4;
            layout.cellSize = new Size(this.CARD_W, this.CARD_H);
        }
    }

    private finishLayout(): void {
        this.contentLayout?.updateLayout();
        this.scheduleOnce(() => this.scrollView?.scrollToTop(0), 0);
    }

    private createItemCard(cropId: number, locked: boolean, cropName: string): Node {
        const card = this.makeRoundedNode(
            `Crop_${cropId}`,
            this.CARD_W,
            this.CARD_H,
            locked ? new Color(224, 216, 190, 255) : this.COLOR_PAPER,
            0,
            0,
            1,
            13,
            locked ? new Color(164, 151, 125, 255) : new Color(205, 163, 91, 255),
            2,
        );

        const namePlate = this.makeRoundedNode(
            'NamePlate',
            this.CARD_W - 18,
            31,
            locked ? new Color(147, 136, 115, 255) : this.COLOR_GREEN_DARK,
            0,
            53,
            2,
            10,
        );
        namePlate.parent = card;
        const name = this.makeLabel('CropName', locked ? '神秘种子' : cropName, 17, Color.WHITE, this.CARD_W - 24, 27);
        name.parent = namePlate;
        name.getComponent(Label)!.isBold = true;

        this.createCropVisual(
            card,
            cropId,
            locked,
            0,
            3,
            this.CARD_CROP_W,
            this.CARD_CROP_H,
        );
        return card;
    }

    private createCropVisual(
        parent: Node,
        cropId: number,
        locked: boolean,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        const visual = new Node('CropVisual');
        visual.layer = Layers.Enum.UI_2D;
        visual.addComponent(UITransform).setContentSize(width, height);
        visual.setPosition(x, y, 2);
        visual.parent = parent;

        const frame = this.findCropFrame(cropId);
        if (frame) {
            const sprite = visual.addComponent(Sprite);
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = locked ? new Color(115, 115, 105, 210) : Color.WHITE;
            return;
        }

        const placeholder = visual.addComponent(Graphics);
        placeholder.fillColor = locked ? new Color(146, 138, 120, 255) : this.getCropColor(cropId);
        placeholder.circle(0, 0, Math.min(width, height) * 0.32);
        placeholder.fill();
        const text = this.makeLabel('Fallback', locked ? '?' : '种', 25, Color.WHITE, 50, 36);
        text.parent = visual;
    }

    /**
     * 选择作物最后一个可用的生长阶段作为商品插画。
     *
     * 图集查询会执行字符串查找，列表频繁刷新时缓存结果可以明显减少重复工作。
     * 尚未加载图集时不缓存 null，确保异步加载完成后仍能正确找到图片。
     */
    private findCropFrame(cropId: number): SpriteFrame | null {
        if (!this.cropAtlas) return null;
        if (this.cropFrameCache.has(cropId)) {
            return this.cropFrameCache.get(cropId) || null;
        }

        for (let stage = 7; stage >= 1; stage--) {
            const baseName = `crop_${cropId}_0${stage}`;
            const frame = this.cropAtlas.getSpriteFrame(baseName)
                || this.cropAtlas.getSpriteFrame(`${baseName}.png`);
            if (frame) {
                this.cropFrameCache.set(cropId, frame);
                return frame;
            }
        }
        this.cropFrameCache.set(cropId, null);
        return null;
    }

    private getCropColor(cropId: number): Color {
        const colors = [
            new Color(238, 122, 61, 255),
            new Color(241, 184, 52, 255),
            new Color(120, 163, 68, 255),
            new Color(178, 103, 73, 255),
            new Color(157, 96, 171, 255),
        ];
        return colors[Math.abs(cropId) % colors.length];
    }

    private showDetailPopup(item: ShopItem | WarehouseItem, mode: DetailMode): void {
        this.closeDetailPopup();
        const price = mode === 'shop' ? (item as ShopItem).seedPrice : (item as WarehouseItem).sellPrice;
        this.detailUnitPrice = price;
        this.detailMaxQuantity = mode === 'shop'
            ? Math.floor((CurrencySystem.getInstance()?.gold || 0) / Math.max(1, price))
            : (item as WarehouseItem).count;
        this.detailQuantity = this.detailMaxQuantity > 0 ? 1 : 0;

        const popup = this.makeRoundedNode('DetailOverlay', 2048, 1536, new Color(10, 23, 14, 155), 0, 0, 30, 0);
        popup.parent = this.node;
        popup.on(Node.EventType.TOUCH_END, (event: any) => {
            event.propagationStopped = true;
            this.closeDetailPopup();
        }, this);
        this.detailPopup = popup;

        const body = this.makeRoundedNode(
            'DetailBody',
            500,
            430,
            this.COLOR_PARCHMENT,
            0,
            0,
            31,
            20,
            this.COLOR_WOOD_DARK,
            5,
        );
        body.parent = popup;
        body.on(Node.EventType.TOUCH_START, (event: any) => {
            event.propagationStopped = true;
        }, this);
        body.on(Node.EventType.TOUCH_END, (event: any) => {
            event.propagationStopped = true;
        }, this);

        const banner = this.makeRoundedNode('Banner', 460, 68, this.COLOR_WOOD, 0, 158, 2, 14);
        banner.parent = body;
        const bannerTitle = this.makeLabel(
            'BannerTitle',
            mode === 'shop' ? '购买种子' : '出售收成',
            27,
            new Color(255, 244, 210, 255),
            300,
            38,
        );
        bannerTitle.parent = banner;
        bannerTitle.getComponent(Label)!.isBold = true;

        this.createCropVisual(
            body,
            item.cropId,
            false,
            -157,
            61,
            this.DETAIL_CROP_W,
            this.DETAIL_CROP_H,
        );
        const name = this.makeLabel('DetailName', item.cropName, 27, this.COLOR_INK, 230, 38);
        name.setPosition(67, 84, 2);
        name.parent = body;
        name.getComponent(Label)!.isBold = true;

        const detailText = mode === 'shop'
            ? `单价 ${price} 金币  ·  成熟约 ${(item as ShopItem).matureTime} 游戏日`
            : `单价 ${price} 金币  ·  当前库存 ${(item as WarehouseItem).count}`;
        const detail = this.makeLabel('DetailText', detailText, 16, this.COLOR_MUTED, 305, 30);
        detail.setPosition(72, 43, 2);
        detail.parent = body;

        const selector = this.makeRoundedNode(
            'QuantitySelector',
            310,
            74,
            this.COLOR_PAPER,
            0,
            -35,
            2,
            14,
            this.COLOR_PAPER_DARK,
            2,
        );
        selector.parent = body;

        const minus = this.makeButton(
            'Minus',
            '－',
            56,
            48,
            this.COLOR_WOOD_LIGHT,
            () => this.changeDetailQuantity(-1),
            Color.WHITE,
            this.COLOR_WOOD,
            25,
        );
        minus.setPosition(-112, 0, 2);
        minus.parent = selector;

        const quantity = this.makeLabel('Quantity', `${this.detailQuantity}`, 30, this.COLOR_INK, 90, 42);
        quantity.parent = selector;
        quantity.getComponent(Label)!.isBold = true;
        this.detailQuantityLabel = quantity.getComponent(Label);

        const plus = this.makeButton(
            'Plus',
            '＋',
            56,
            48,
            this.COLOR_GREEN,
            () => this.changeDetailQuantity(1),
            Color.WHITE,
            this.COLOR_GREEN_DARK,
            25,
        );
        plus.setPosition(112, 0, 2);
        plus.parent = selector;

        const max = this.makeLabel('Max', `最多 ${this.detailMaxQuantity}`, 14, this.COLOR_MUTED, 140, 24);
        max.setPosition(0, -62, 2);
        max.parent = body;

        const total = this.makeLabel('Total', '', 22, this.COLOR_WOOD_DARK, 310, 34);
        total.setPosition(0, -119, 2);
        total.parent = body;
        total.getComponent(Label)!.isBold = true;
        this.detailTotalLabel = total.getComponent(Label);
        this.updateDetailTotal();

        const canOperate = this.detailMaxQuantity > 0;
        const confirm = this.makeButton(
            'Confirm',
            canOperate ? (mode === 'shop' ? '确认购买' : '确认出售') : (mode === 'shop' ? '金币不足' : '没有库存'),
            150,
            50,
            canOperate ? this.COLOR_GREEN : new Color(154, 143, 121, 255),
            () => {
                if (!canOperate) return;
                if (mode === 'shop') {
                    this.confirmBuy(item as ShopItem);
                } else {
                    this.confirmSell(item as WarehouseItem);
                }
            },
            Color.WHITE,
            canOperate ? this.COLOR_GREEN_DARK : new Color(119, 108, 90, 255),
            19,
        );
        confirm.setPosition(-86, -174, 2);
        confirm.parent = body;

        const cancel = this.makeButton(
            'Cancel',
            '取消',
            126,
            50,
            this.COLOR_WOOD_LIGHT,
            () => this.closeDetailPopup(),
            Color.WHITE,
            this.COLOR_WOOD,
            19,
        );
        cancel.setPosition(94, -174, 2);
        cancel.parent = body;

        body.setScale(new Vec3(0.88, 0.88, 1));
        tween(body).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    }

    private changeDetailQuantity(delta: number): void {
        const next = this.detailQuantity + delta;
        if (next < 1 || next > this.detailMaxQuantity) return;
        this.detailQuantity = next;
        if (this.detailQuantityLabel) this.detailQuantityLabel.string = `${next}`;
        this.updateDetailTotal();
    }

    private updateDetailTotal(): void {
        if (!this.detailTotalLabel) return;
        this.detailTotalLabel.string = `合计 ${this.detailQuantity * this.detailUnitPrice} 金币`;
    }

    private confirmBuy(item: ShopItem): void {
        const result = ShopManager.getInstance()?.buySeed(item.cropId, this.detailQuantity);
        if (!result?.success) {
            this.showInfo(result?.message || '购买失败，请稍后重试');
            return;
        }
        this.showInfo(`已购买 ${item.cropName}种子 ×${this.detailQuantity}，并设为优先种子`);
        this.closeDetailPopup();
        this.updateCurrencyDisplay();
        this.refreshShopContent();
        this.updateSummary();
    }

    private confirmSell(item: WarehouseItem): void {
        const earnings = WarehouseManager.getInstance()?.sellCrop(item.cropId, this.detailQuantity) || 0;
        if (earnings <= 0) {
            this.showInfo('出售失败，请确认库存数量');
            return;
        }
        CurrencySystem.getInstance()?.addGold(earnings);
        this.showInfo(`出售 ${item.cropName} ×${this.detailQuantity}，获得 ${earnings} 金币`);
        this.closeDetailPopup();
        this.updateCurrencyDisplay();
        this.refreshWarehouseStock();
        this.updateSummary();
    }

    private closeDetailPopup(): void {
        if (this.detailPopup?.isValid) this.detailPopup.destroy();
        this.detailPopup = null;
        this.detailQuantityLabel = null;
        this.detailTotalLabel = null;
    }

    private updateSummary = (): void => {
        if (!this.summaryLabel) return;

        if (this.mode === 'shop') {
            const shop = ShopManager.getInstance();
            const selected = shop?.getItem(shop.getSelectedSeedCropId());
            const selectedText = selected ? `优先种子：${selected.cropName}` : '尚未选择优先种子';
            this.summaryLabel.string = `${shop?.getUnlockedCount() || 0}/${shop?.getItemCount() || 0} 已解锁  ·  ${selectedText}`;
        } else if (this.mode === 'warehouse' && this.warehouseTab === 'stock') {
            const warehouse = WarehouseManager.getInstance();
            this.summaryLabel.string = `共 ${warehouse?.getTotalItemCount() || 0} 份收成  ·  总价值 ${warehouse?.getTotalValue() || 0} 金币`;
        } else if (this.mode === 'warehouse') {
            const orders = MarketOrderManager.getInstance();
            this.summaryLabel.string = `${orders?.getActiveOrders().length || 0} 个待交付订单  ·  ${this.formatRemainingTime(orders?.getTimeToRefresh() || 0)} 后刷新`;
        } else {
            this.summaryLabel.string = '3 个本地存档位  ·  游戏同时提供自动保存';
        }
    };

    private onGoldChanged(): void {
        this.updateCurrencyDisplay();
        if (this.mode === 'shop' && !this.detailPopup) this.refreshShopContent();
        this.updateSummary();
    }

    private onLevelChanged(): void {
        this.updateCurrencyDisplay();
        if (this.mode === 'shop') {
            this.rebuildNavigation();
            this.refreshShopContent();
        }
    }

    private onShopChanged(): void {
        if (this.mode === 'shop' && !this.detailPopup) this.refreshShopContent();
        this.updateSummary();
    }

    private onWarehouseChanged(): void {
        if (this.mode === 'warehouse' && !this.detailPopup) this.refreshWarehouseContent();
        this.updateSummary();
    }

    private onOrdersChanged(): void {
        if (this.mode === 'warehouse' && this.warehouseTab === 'orders') this.refreshOrderContent();
        this.updateSummary();
    }

    private createEmptyState(title: string, description: string): void {
        if (!this.contentNode) return;
        const empty = this.makeRoundedNode(
            'EmptyState',
            this.CONTENT_W - 54,
            180,
            new Color(248, 235, 199, 255),
            0,
            0,
            1,
            16,
            this.COLOR_PAPER_DARK,
            2,
        );
        empty.parent = this.contentNode;
        const sprout = this.makeLabel('Sprout', '田', 42, this.COLOR_GREEN, 80, 55);
        sprout.setPosition(0, 47, 2);
        sprout.parent = empty;
        const titleNode = this.makeLabel('EmptyTitle', title, 23, this.COLOR_INK, 500, 34);
        titleNode.setPosition(0, 2, 2);
        titleNode.parent = empty;
        titleNode.getComponent(Label)!.isBold = true;
        const descriptionNode = this.makeLabel('EmptyDescription', description, 16, this.COLOR_MUTED, 650, 30);
        descriptionNode.setPosition(0, -41, 2);
        descriptionNode.parent = empty;
        this.finishLayout();
    }

    private bindCardTap(card: Node, callback: () => void): void {
        card.on(Node.EventType.TOUCH_START, () => {
            tween(card).to(0.06, { scale: new Vec3(0.96, 0.96, 1) }).start();
        }, this);
        card.on(Node.EventType.TOUCH_END, () => {
            tween(card).to(0.08, { scale: Vec3.ONE }).start();
            callback();
        }, this);
        card.on(Node.EventType.TOUCH_CANCEL, () => {
            tween(card).to(0.08, { scale: Vec3.ONE }).start();
        }, this);
    }

    private makeButton(
        name: string,
        text: string,
        width: number,
        height: number,
        color: Color,
        callback: () => void,
        textColor: Color,
        borderColor?: Color,
        fontSize = 17,
    ): Node {
        const button = this.makeRoundedNode(
            name,
            width,
            height,
            color,
            0,
            0,
            1,
            Math.min(13, height / 2),
            borderColor || null,
            borderColor ? 2 : 0,
        );
        const labelNode = this.makeLabel('Label', text, fontSize, textColor, width - 8, height - 4);
        labelNode.parent = button;
        labelNode.getComponent(Label)!.isBold = true;

        button.on(Node.EventType.TOUCH_START, (event: any) => {
            event.propagationStopped = true;
            tween(button).to(0.05, { scale: new Vec3(0.95, 0.95, 1) }).start();
        }, this);
        button.on(Node.EventType.TOUCH_END, (event: any) => {
            event.propagationStopped = true;
            tween(button).to(0.07, { scale: Vec3.ONE }).start();
            callback();
        }, this);
        button.on(Node.EventType.TOUCH_CANCEL, (event: any) => {
            event.propagationStopped = true;
            tween(button).to(0.07, { scale: Vec3.ONE }).start();
        }, this);
        return button;
    }

    private makeRoundedNode(
        name: string,
        width: number,
        height: number,
        color: Color,
        x: number,
        y: number,
        z: number,
        radius: number,
        borderColor: Color | null = null,
        borderWidth = 0,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        node.setPosition(x, y, z);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        if (radius > 0) {
            graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        } else {
            graphics.rect(-width / 2, -height / 2, width, height);
        }
        graphics.fill();

        if (borderColor && borderWidth > 0) {
            graphics.strokeColor = borderColor;
            graphics.lineWidth = borderWidth;
            if (radius > 0) {
                graphics.roundRect(-width / 2, -height / 2, width, height, radius);
            } else {
                graphics.rect(-width / 2, -height / 2, width, height);
            }
            graphics.stroke();
        }
        return node;
    }

    private makeLabel(
        name: string,
        text: string,
        fontSize: number,
        color: Color,
        width: number,
        height: number,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 4, height - 2);
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return node;
    }

    private addLeafDecoration(parent: Node, x: number, y: number, mirrored: boolean): void {
        const decoration = new Node(mirrored ? 'LeavesRight' : 'LeavesLeft');
        decoration.layer = Layers.Enum.UI_2D;
        decoration.addComponent(UITransform).setContentSize(92, 54);
        decoration.setPosition(x, y, 1);
        decoration.parent = parent;
        const graphics = decoration.addComponent(Graphics);
        graphics.fillColor = this.COLOR_GREEN_DARK;
        graphics.ellipse(mirrored ? 20 : -20, 8, 28, 14);
        graphics.fill();
        graphics.fillColor = this.COLOR_GREEN_LIGHT;
        graphics.ellipse(mirrored ? 4 : -4, -9, 24, 12);
        graphics.fill();
        graphics.strokeColor = new Color(225, 177, 91, 255);
        graphics.lineWidth = 3;
        graphics.moveTo(mirrored ? -37 : 37, -18);
        graphics.lineTo(mirrored ? 35 : -35, 18);
        graphics.stroke();
    }

    private formatRemainingTime(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    private formatPlayTime(seconds: number): string {
        const safeSeconds = Math.max(0, Math.floor(seconds || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        return `${hours}小时${minutes}分`;
    }

    private showInfo(message: string): void {
        if (this.infoLabel) this.infoLabel.string = message;
    }

    public close(): void {
        if (!this.node.isValid) return;
        this.closeDetailPopup();
        eventBus.emit(GameEvent.UI_CLOSE, { panel: this.mode });
    }
}
