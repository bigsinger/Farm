import { _decorator, Component, Node, Label, Color, Sprite, UITransform, UIOpacity, tween, ScrollView, Layout, ScrollBar, Mask, Graphics, Vec2, Size } from 'cc';
import { AchievementManager, AchievementData, AchievementLevel } from './AchievementManager';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/** 成就分类标签 */
const CATEGORIES = [
    { id: 'all', name: '全部' },
    { id: 'plant', name: '种植' },
    { id: 'harvest', name: '收获' },
    { id: 'sell', name: '销售' },
    { id: 'extend', name: '扩建' },
    { id: 'gold', name: '金币' },
    { id: 'exp', name: '经验' },
    { id: 'special', name: '特殊' },
];

/** 等级颜色映射 */
const LEVEL_COLORS: Record<AchievementLevel, Color> = {
    [AchievementLevel.Bronze]: new Color(205, 127, 50),
    [AchievementLevel.Silver]: new Color(192, 192, 192),
    [AchievementLevel.Gold]: new Color(255, 215, 0),
    [AchievementLevel.Platinum]: new Color(229, 228, 226),
    [AchievementLevel.Diamond]: new Color(185, 242, 255),
};

const LEVEL_NAMES: Record<AchievementLevel, string> = {
    [AchievementLevel.Bronze]: '青铜',
    [AchievementLevel.Silver]: '白银',
    [AchievementLevel.Gold]: '黄金',
    [AchievementLevel.Platinum]: '白金',
    [AchievementLevel.Diamond]: '钻石',
};

/**
 * 成就面板 — 背包风格网格展示
 * 纯代码构建UI，展示所有成就及进度
 */
@ccclass('UIAchievementPanel')
export class UIAchievementPanel extends Component {

    private _manager: AchievementManager = null;
    private _gridNode: Node = null;
    private _scrollView: ScrollView = null;
    private _tabContainer: Node = null;
    private _statsLabel: Label = null;
    private _activeCategory: string = 'all';
    private _cardNodes: Node[] = [];
    private _isOpen: boolean = false;

    onLoad() {
        this._manager = AchievementManager.getInstance();
        this.buildUI();
        this.registerEvents();
        this.node.active = false;
    }

    onDestroy() {
        this.unregisterEvents();
    }

    // ==================== 公共API ====================

    /** 打开面板 */
    public open(): void {
        if (this._isOpen) return;
        this._isOpen = true;
        this.node.active = true;
        this.refresh();
    }

    /** 关闭面板 */
    public close(): void {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.node.active = false;
        eventBus.emit(GameEvent.UI_CLOSE, { panel: 'achievement' });
    }

    /** 切换显示 */
    public toggle(): void {
        if (this._isOpen) this.close();
        else this.open();
    }

    // ==================== UI构建 ====================

    private buildUI(): void {
        const canvas = this.node;
        canvas.setPosition(0, 0, 0);

        // 半透明背景遮罩
        const bg = new Node('bg');
        const bgUI = bg.addComponent(UITransform);
        bgUI.setContentSize(720, 1280);
        const bgGfx = bg.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 200);
        bgGfx.rect(-360, -640, 720, 1280);
        bgGfx.fill();
        canvas.addChild(bg);

        // 面板容器
        const panel = new Node('panel');
        const pUI = panel.addComponent(UITransform);
        pUI.setContentSize(680, 1080);
        panel.setPosition(0, 20, 0);
        const pGfx = panel.addComponent(Graphics);
        pGfx.fillColor = new Color(40, 30, 20, 240);
        pGfx.roundRect(-340, -540, 680, 1080, 16);
        pGfx.fill();
        pGfx.strokeColor = new Color(120, 90, 40, 255);
        pGfx.lineWidth = 2;
        pGfx.fill();
        pGfx.stroke();
        canvas.addChild(panel);

        // 标题栏
        const titleBar = new Node('titleBar');
        const tbUI = titleBar.addComponent(UITransform);
        tbUI.setContentSize(640, 60);
        titleBar.setPosition(0, 500, 0);
        const tbGfx = titleBar.addComponent(Graphics);
        tbGfx.fillColor = new Color(60, 45, 20, 230);
        tbGfx.roundRect(-320, -30, 640, 60, 12);
        tbGfx.fill();
        panel.addChild(titleBar);

        // 标题文字
        const titleLabel = new Node('title');
        const tUI = titleLabel.addComponent(UITransform);
        tUI.setContentSize(200, 40);
        const tl = titleLabel.addComponent(Label);
        tl.string = '🏆 成就殿堂';
        tl.fontSize = 28;
        tl.color = new Color(255, 215, 0);
        tl.horizontalAlign = Label.HorizontalAlign.LEFT;
        titleLabel.setPosition(-260, 0, 0);
        titleBar.addChild(titleLabel);

        // 关闭按钮
        const closeBtn = this.createButton('✕', new Color(180, 60, 60), () => this.close());
        closeBtn.setPosition(295, 0, 0);
        titleBar.addChild(closeBtn);

        // 统计标签
        const statsNode = new Node('stats');
        const sUI = statsNode.addComponent(UITransform);
        sUI.setContentSize(600, 32);
        statsNode.setPosition(0, 460, 0);
        this._statsLabel = statsNode.addComponent(Label);
        this._statsLabel.fontSize = 18;
        this._statsLabel.color = new Color(180, 160, 120);
        this._statsLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        panel.addChild(statsNode);

        // 分类标签栏
        this._tabContainer = new Node('tabs');
        const tabUI = this._tabContainer.addComponent(UITransform);
        tabUI.setContentSize(640, 44);
        this._tabContainer.setPosition(0, 420, 0);
        panel.addChild(this._tabContainer);
        this.buildTabs();

        // 滚动视口
        this._scrollView = this.createScrollView(panel, 0, -60, 620, 700);

        // 网格容器
        this._gridNode = new Node('grid');
        const gridUI = this._gridNode.addComponent(UITransform);
        gridUI.setContentSize(600, 200);
        const layout = this._gridNode.addComponent(Layout);
        layout.type = Layout.Type.GRID;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.startAxis = Layout.AxisDirection.HORIZONTAL;
        layout.cellSize = new Size(280, 100);
        layout.spacingX = 16;
        layout.spacingY = 12;
        layout.paddingTop = 0;
        layout.paddingBottom = 8;
        this._scrollView.content.addChild(this._gridNode);
    }

    /** 构建分类标签 */
    private buildTabs(): void {
        const tabWidth = 68;
        const gap = 8;
        const total = CATEGORIES.length;
        const startX = -((total - 1) * (tabWidth + gap)) / 2;

        CATEGORIES.forEach((cat, i) => {
            const tabNode = new Node(`tab_${cat.id}`);
            const tabT = tabNode.addComponent(UITransform);
            tabT.setContentSize(tabWidth, 36);
            tabNode.setPosition(startX + i * (tabWidth + gap), 0, 0);

            const tabBg = tabNode.addComponent(Graphics);
            this.drawTabBg(tabBg, tabWidth, 36, cat.id === 'all');

            const label = new Node('label');
            const lUI = label.addComponent(UITransform);
            lUI.setContentSize(tabWidth, 36);
            const lbl = label.addComponent(Label);
            lbl.string = cat.name;
            lbl.fontSize = 16;
            lbl.color = cat.id === 'all' ? new Color(255, 215, 0) : new Color(180, 160, 130);
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            tabNode.addChild(label);

            tabNode.once('ready', () => {
                tabNode.on(Node.EventType.TOUCH_END, () => this.switchCategory(cat.id, tabNode), this);
            });

            this._tabContainer.addChild(tabNode);
        });
    }

    private drawTabBg(gfx: Graphics, w: number, h: number, active: boolean): void {
        gfx.fillColor = active ? new Color(80, 60, 20, 200) : new Color(50, 40, 20, 160);
        gfx.roundRect(-w / 2, -h / 2, w, h, 8);
        gfx.fill();
        if (active) {
            gfx.strokeColor = new Color(255, 215, 0, 180);
            gfx.lineWidth = 1.5;
            gfx.stroke();
        }
    }

    /** 创建滚动视图 */
    private createScrollView(parent: Node, x: number, y: number, w: number, h: number): ScrollView {
        const svNode = new Node('scrollView');
        svNode.setPosition(x, y, 0);
        const svUI = svNode.addComponent(UITransform);
        svUI.setContentSize(w, h);
        const sv = svNode.addComponent(ScrollView);
        sv.bounceDuration = 0.3;
        sv.horizontal = false;
        sv.vertical = true;
        sv.inertia = true;
        sv.elastic = true;

        // Mask
        const mask = svNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        const maskGfx = svNode.addComponent(Graphics);
        maskGfx.fillColor = new Color(0, 0, 0, 0);
        maskGfx.rect(-w / 2, -h / 2, w, h);

        // Content
        const content = new Node('content');
        const cUI = content.addComponent(UITransform);
        cUI.setContentSize(w, h);
        sv.content = content;
        svNode.addChild(content);

        // Scrollbar
        const sbNode = new Node('scrollbar');
        const sbUI = sbNode.addComponent(UITransform);
        sbUI.setContentSize(8, h);
        sbNode.setPosition(w / 2 - 10, 0, 0);
        const sb = sbNode.addComponent(ScrollBar);
        const handleNode = new Node('handle');
        const handleSprite = handleNode.addComponent(Sprite);
        sb.handle = handleSprite;
        const hUI = handleNode.addComponent(UITransform);
        hUI.setContentSize(8, 60);
        const hGfx = handleNode.addComponent(Graphics);
        hGfx.fillColor = new Color(160, 130, 80, 200);
        hGfx.roundRect(-4, -30, 8, 60, 4);
        hGfx.fill();
        sbNode.addChild(handleNode);
        sv.verticalScrollBar = sb;
        svNode.addChild(sbNode);

        parent.addChild(svNode);
        return sv;
    }

    /** 创建按钮 */
    private createButton(text: string, color: Color, callback: () => void): Node {
        const btn = new Node('btn');
        const bUI = btn.addComponent(UITransform);
        bUI.setContentSize(56, 44);
        const bGfx = btn.addComponent(Graphics);
        bGfx.fillColor = color;
        bGfx.roundRect(-28, -22, 56, 44, 8);
        bGfx.fill();
        btn.on(Node.EventType.TOUCH_END, callback, this);
        return btn;
    }

    // ==================== 事件 ====================

    private registerEvents(): void {
        eventBus.on(GameEvent.ACHIEVEMENT_UNLOCKED, this.onAchievementUnlocked, this);
    }

    private unregisterEvents(): void {
        eventBus.off(GameEvent.ACHIEVEMENT_UNLOCKED, this.onAchievementUnlocked, this);
    }

    private onAchievementUnlocked(): void {
        if (this._isOpen) this.refresh();
    }

    // ==================== 刷新 ====================

    private switchCategory(catId: string, tabNode: Node): void {
        this._activeCategory = catId;

        // 更新标签样式
        for (const child of this._tabContainer.children) {
            const gfx = child.getComponent(Graphics);
            if (gfx) {
                const isActive = child === tabNode;
                this.drawTabBg(gfx, child.getComponent(UITransform).width, 36, isActive);
            }
            const label = child.children[0]?.getComponent(Label);
            if (label) {
                label.color = child === tabNode ? new Color(255, 215, 0) : new Color(180, 160, 130);
            }
        }

        this.refresh();
    }

    /** 刷新整个面板 */
    public refresh(): void {
        if (!this._gridNode || !this._manager) return;

        // 清空旧卡片
        for (const node of this._cardNodes) {
            if (node.isValid) node.destroy();
        }
        this._cardNodes = [];

        // 获取成就列表
        let achievements = this._manager.getAllAchievements();
        achievements = achievements.filter(a => this.matchCategory(a));

        // 排序：未完成在前，按等级排序
        achievements.sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return b.level - a.level;
        });

        // 更新统计
        const stats = this._manager.getAchievementStats();
        this._statsLabel.string =
            `📊 ${stats.completed}/${stats.total} 已完成 (${Math.round(stats.completionRate * 100)}%) | 💰 奖励: ${stats.totalRewardGold} 金币 | ⭐ ${stats.totalRewardExp} 经验`;

        // 生成卡片
        for (const ach of achievements) {
            const card = this.createAchievementCard(ach);
            this._gridNode.addChild(card);
            this._cardNodes.push(card);
        }

        // 强制更新Layout
        const layout = this._gridNode.getComponent(Layout);
        if (layout) layout.updateLayout();
    }

    private matchCategory(ach: AchievementData): boolean {
        if (this._activeCategory === 'all') return true;
        const typeMap: Record<string, string> = {
            'plant': '1', 'harvest': '2', 'sell': '3', 'extend': '4',
            'login': '5', 'exp': '6', 'gold': '7', 'special': '99',
        };
        return typeMap[this._activeCategory] === String(ach.type);
    }

    // ==================== 成就卡片 ====================

    private createAchievementCard(ach: AchievementData): Node {
        const card = new Node(`card_${ach.id}`);
        const ct = card.addComponent(UITransform);
        ct.setContentSize(280, 100);

        // 卡片背景
        const bgGfx = card.addComponent(Graphics);
        const bgColor = ach.isCompleted
            ? new Color(40, 50, 35, 220)
            : new Color(50, 45, 35, 200);
        bgGfx.fillColor = bgColor;
        bgGfx.roundRect(-140, -50, 280, 100, 10);
        bgGfx.fill();
        bgGfx.strokeColor = LEVEL_COLORS[ach.level];
        bgGfx.lineWidth = ach.isCompleted ? 2 : 1;
        bgGfx.stroke();

        // 等级徽章（左侧）
        const badge = new Node('badge');
        const bUI = badge.addComponent(UITransform);
        bUI.setContentSize(56, 72);
        badge.setPosition(-110, 0, 0);
        const bGfx = badge.addComponent(Graphics);
        const lc = LEVEL_COLORS[ach.level];
        bGfx.fillColor = ach.isCompleted
            ? new Color(lc.r, lc.g, lc.b, 200)
            : new Color(lc.r * 0.5, lc.g * 0.5, lc.b * 0.5, 120);
        bGfx.circle(0, 0, 24);
        bGfx.fill();
        bGfx.strokeColor = lc;
        bGfx.lineWidth = 2;
        bGfx.stroke();

        const badgeLabel = new Node('badgeLabel');
        const blUI = badgeLabel.addComponent(UITransform);
        blUI.setContentSize(56, 24);
        badgeLabel.setPosition(0, -34, 0);
        const bl = badgeLabel.addComponent(Label);
        bl.string = LEVEL_NAMES[ach.level];
        bl.fontSize = 12;
        bl.color = ach.isCompleted ? lc : new Color(lc.r * 0.5, lc.g * 0.5, lc.b * 0.5, 200);
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        badge.addChild(badgeLabel);

        // 星级图标
        const starLabel = new Node('star');
        const stUI = starLabel.addComponent(UITransform);
        stUI.setContentSize(56, 28);
        starLabel.setPosition(0, 0, 0);
        const sl = starLabel.addComponent(Label);
        sl.string = ach.isCompleted ? '⭐' : '☆';
        sl.fontSize = 22;
        sl.color = ach.isCompleted ? new Color(255, 215, 0) : new Color(100, 100, 100);
        sl.horizontalAlign = Label.HorizontalAlign.CENTER;
        badge.addChild(starLabel);

        card.addChild(badge);

        // 成就名称（右上方）
        const nameNode = new Node('name');
        const nUI = nameNode.addComponent(UITransform);
        nUI.setContentSize(180, 24);
        nameNode.setPosition(20, 22, 0);
        const nl = nameNode.addComponent(Label);
        nl.string = ach.name;
        nl.fontSize = 16;
        nl.color = ach.isCompleted ? new Color(255, 215, 0) : new Color(220, 210, 190);
        nl.horizontalAlign = Label.HorizontalAlign.LEFT;
        nl.overflow = Label.Overflow.SHRINK;
        card.addChild(nameNode);

        // 描述（右上方下）
        const descNode = new Node('desc');
        const dUI = descNode.addComponent(UITransform);
        dUI.setContentSize(180, 18);
        descNode.setPosition(20, -2, 0);
        const dl = descNode.addComponent(Label);
        dl.string = ach.description;
        dl.fontSize = 12;
        dl.color = new Color(150, 140, 120);
        dl.horizontalAlign = Label.HorizontalAlign.LEFT;
        dl.overflow = Label.Overflow.SHRINK;
        card.addChild(descNode);

        // 进度条
        const progress = this.createProgressBar(
            ach.targetValue,
            ach.currentValue,
            ach.isCompleted,
            180, 12
        );
        progress.setPosition(20, -24, 0);
        card.addChild(progress);

        // 奖励标签
        const rewardNode = new Node('reward');
        const rUI = rewardNode.addComponent(UITransform);
        rUI.setContentSize(180, 18);
        rewardNode.setPosition(20, -40, 0);
        const rl = rewardNode.addComponent(Label);
        rl.string = `💰${ach.rewardGold} ⭐${ach.rewardExp}`;
        rl.fontSize = 12;
        rl.color = ach.isCompleted ? new Color(180, 160, 120) : new Color(120, 110, 90);
        rl.horizontalAlign = Label.HorizontalAlign.LEFT;
        card.addChild(rewardNode);

        return card;
    }

    private createProgressBar(
        max: number,
        current: number,
        completed: boolean,
        width: number,
        height: number
    ): Node {
        const barNode = new Node('progressBar');
        const bUI = barNode.addComponent(UITransform);
        bUI.setContentSize(width, height);

        // 背景
        const bgGfx = barNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(40, 40, 40, 200);
        bgGfx.roundRect(-width / 2, -height / 2, width, height, height / 2);
        bgGfx.fill();

        // 进度填充
        const ratio = completed ? 1 : Math.min(current / Math.max(max, 1), 1);
        const fillW = (width - 4) * ratio;
        if (fillW > 0) {
            bgGfx.fillColor = completed
                ? new Color(76, 175, 80, 220)
                : new Color(255, 152, 0, 200);
            bgGfx.roundRect(-width / 2 + 2, -height / 2 + 2, fillW, height - 4, (height - 4) / 2);
            bgGfx.fill();
        }

        // 文字
        const textNode = new Node('text');
        const tUI = textNode.addComponent(UITransform);
        tUI.setContentSize(width, height);
        const tl = textNode.addComponent(Label);
        tl.string = completed ? '✓ 已完成' : `${current}/${max}`;
        tl.fontSize = 10;
        tl.color = new Color(255, 255, 255, 240);
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        barNode.addChild(textNode);

        return barNode;
    }
}
