import { _decorator, Component, Node, Label, Color, Graphics, Sprite, UITransform, Size, Mask, ScrollView, Layout, Button, ScrollBar } from 'cc';
import { TaskManager, TaskData, TaskStatus, TaskType } from './TaskManager';
import { eventBus, GameEvent } from './EventBus';
const { ccclass } = _decorator;

const STATUS_MAP: Record<TaskStatus, { label: string; color: Color }> = {
    [TaskStatus.Locked]: { label: '未接取', color: new Color(120, 120, 120) },
    [TaskStatus.Active]: { label: '进行中', color: new Color(255, 152, 0) },
    [TaskStatus.Completed]: { label: '可领取', color: new Color(76, 175, 80) },
    [TaskStatus.Rewarded]: { label: '已完成', color: new Color(100, 100, 100) },
};

const TYPE_NAMES: Record<TaskType, string> = {
    [TaskType.Plant]: '种植',
    [TaskType.Harvest]: '收获',
    [TaskType.Sell]: '销售',
    [TaskType.Extend]: '扩建',
    [TaskType.Login]: '登录',
};

/**
 * 任务面板 — 背包风格滚动列表
 * 展示每日/主线任务，支持接受和领取奖励
 */
@ccclass('UITaskPanel')
export class UITaskPanel extends Component {

    private _manager: TaskManager = null;
    private _gridNode: Node = null;
    private _scrollView: ScrollView = null;
    private _cardNodes: Node[] = [];
    private _isOpen: boolean = false;

    onLoad() {
        this._manager = TaskManager.getInstance();
        this.buildUI();
        this.registerEvents();
        this.node.active = false;
    }

    onDestroy() {
        this.unregisterEvents();
    }

    public open(): void {
        if (this._isOpen) return;
        this._isOpen = true;
        this.node.active = true;
        this.refresh();
    }

    public close(): void {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.node.active = false;
        eventBus.emit(GameEvent.UI_CLOSE, { panel: 'task' });
    }

    public toggle(): void {
        if (this._isOpen) this.close();
        else this.open();
    }

    private refresh(): void {
        if (!this._gridNode || !this._manager) return;

        for (const n of this._cardNodes) {
            if (n.isValid) n.destroy();
        }
        this._cardNodes = [];

        const tasks = this._manager.getAllTasks();
        tasks.sort((a, b) => {
            const order = { [TaskStatus.Completed]: 0, [TaskStatus.Active]: 1, [TaskStatus.Locked]: 2, [TaskStatus.Rewarded]: 3 };
            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
        });

        for (const task of tasks) {
            const card = this.createTaskCard(task);
            this._gridNode.addChild(card);
            this._cardNodes.push(card);
        }

        const layout = this._gridNode.getComponent(Layout);
        if (layout) layout.updateLayout();
    }

    private buildUI(): void {
        const canvas = this.node;

        // 背景遮罩
        const bg = new Node('bg');
        const bgUI = bg.addComponent(UITransform);
        bgUI.setContentSize(720, 1280);
        const bgGfx = bg.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 200);
        bgGfx.rect(-360, -640, 720, 1280);
        bgGfx.fill();
        canvas.addChild(bg);

        // 面板
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
        pGfx.stroke();
        canvas.addChild(panel);

        // 标题栏
        const tb = new Node('titleBar');
        const tUI = tb.addComponent(UITransform);
        tUI.setContentSize(640, 60);
        tb.setPosition(0, 500, 0);
        const tGfx = tb.addComponent(Graphics);
        tGfx.fillColor = new Color(60, 45, 20, 230);
        tGfx.roundRect(-320, -30, 640, 60, 12);
        tGfx.fill();
        panel.addChild(tb);

        const tl = new Node('title').addComponent(Label);
        tl.string = '📋 任务列表';
        tl.fontSize = 28;
        tl.color = new Color(255, 200, 100);
        tl.horizontalAlign = Label.HorizontalAlign.LEFT;
        const tlUI = tl.node.addComponent(UITransform);
        tlUI.setContentSize(200, 40);
        tl.node.setPosition(-260, 0, 0);
        tb.addChild(tl.node);

        const closeBtn = this.makeBtn('✕', new Color(180, 60, 60), () => this.close());
        closeBtn.setPosition(295, 0, 0);
        tb.addChild(closeBtn);

        // 滚动视图
        this._scrollView = this.makeScrollView(panel, 0, -40, 620, 900);
        this._gridNode = new Node('grid');
        const gUI = this._gridNode.addComponent(UITransform);
        gUI.setContentSize(600, 200);
        const lay = this._gridNode.addComponent(Layout);
        lay.type = Layout.Type.GRID;
        lay.resizeMode = Layout.ResizeMode.CONTAINER;
        lay.startAxis = Layout.AxisDirection.HORIZONTAL;
        lay.cellSize = new Size(590, 80);
        lay.spacingX = 10;
        lay.spacingY = 8;
        lay.paddingTop = 0;
        lay.paddingBottom = 8;
        this._scrollView.content.addChild(this._gridNode);
    }

    private createTaskCard(task: TaskData): Node {
        const card = new Node(`task_${task.id}`);
        const ct = card.addComponent(UITransform);
        ct.setContentSize(590, 80);

        const bg = card.addComponent(Graphics);
        const glow = task.status === TaskStatus.Completed;
        bg.fillColor = glow ? new Color(50, 65, 45, 220) : new Color(50, 45, 35, 200);
        bg.roundRect(-295, -40, 590, 80, 10);
        bg.fill();
        if (glow) {
            bg.strokeColor = new Color(76, 175, 80, 180);
            bg.lineWidth = 2;
            bg.stroke();
        }

        // 类型标签
        const typeName = TYPE_NAMES[task.type] || '任务';
        const typeNode = new Node('type');
        const tUI = typeNode.addComponent(UITransform);
        tUI.setContentSize(60, 24);
        typeNode.setPosition(-260, 24, 0);
        const tGfx = typeNode.addComponent(Graphics);
        tGfx.fillColor = new Color(100, 80, 45, 200);
        tGfx.roundRect(-30, -12, 60, 24, 6);
        tGfx.fill();
        const tLab = new Node('tLab').addComponent(Label);
        tLab.string = typeName;
        tLab.fontSize = 12;
        tLab.color = new Color(220, 200, 160);
        tLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        tLab.node.addComponent(UITransform).setContentSize(60, 24);
        typeNode.addChild(tLab.node);
        card.addChild(typeNode);

        // 标题
        const title = new Node('title').addComponent(Label);
        title.string = task.title || task.description;
        title.fontSize = 18;
        title.color = task.status === TaskStatus.Rewarded ? new Color(140, 140, 140) : new Color(230, 220, 200);
        title.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.overflow = Label.Overflow.SHRINK;
        title.node.addComponent(UITransform).setContentSize(350, 24);
        title.node.setPosition(-40, 22, 0);
        card.addChild(title.node);

        // 描述
        const desc = new Node('desc').addComponent(Label);
        desc.string = task.description || '';
        desc.fontSize = 13;
        desc.color = new Color(160, 150, 130);
        desc.horizontalAlign = Label.HorizontalAlign.LEFT;
        desc.overflow = Label.Overflow.SHRINK;
        desc.node.addComponent(UITransform).setContentSize(350, 20);
        desc.node.setPosition(-40, -2, 0);
        card.addChild(desc.node);

        // 进度
        if (task.targetCount > 0) {
            const prog = this.makeProgressBar(task.currentCount, task.targetCount, task.status === TaskStatus.Completed, 350);
            prog.setPosition(-40, -24, 0);
            card.addChild(prog);
        }

        // 奖励
        const rew = new Node('reward').addComponent(Label);
        rew.string = `💰${task.rewardGold || 0} ⭐${task.rewardExp || 0}`;
        rew.fontSize = 12;
        rew.color = new Color(180, 160, 120);
        rew.horizontalAlign = Label.HorizontalAlign.LEFT;
        rew.node.addComponent(UITransform).setContentSize(200, 18);
        rew.node.setPosition(-40, -40, 0);
        card.addChild(rew.node);

        // 状态按钮
        const st = STATUS_MAP[task.status];
        const btn = this.makeBtn(st.label, st.color, () => this.onTaskAction(task.id));
        btn.setPosition(250, 0, 0);
        card.addChild(btn);

        return card;
    }

    private onTaskAction(taskId: string): void {
        if (!this._manager) return;
        const tasks = this._manager.getAllTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (task.status === TaskStatus.Locked) {
            this._manager.acceptTask(taskId);
        } else if (task.status === TaskStatus.Completed) {
            this._manager.claimReward(taskId);
        }
        this.scheduleOnce(() => this.refresh(), 0.1);
    }

    private makeProgressBar(current: number, max: number, completed: boolean, w: number): Node {
        const bar = new Node('bar');
        const bu = bar.addComponent(UITransform);
        bu.setContentSize(w, 10);
        const g = bar.addComponent(Graphics);
        g.fillColor = new Color(40, 40, 40, 200);
        g.roundRect(-w / 2, -5, w, 10, 5);
        g.fill();
        const r = completed ? 1 : Math.min(current / Math.max(max, 1), 1);
        if (r > 0) {
            g.fillColor = completed ? new Color(76, 175, 80, 200) : new Color(255, 152, 0, 200);
            g.roundRect(-w / 2 + 1, -4, (w - 2) * r, 8, 4);
            g.fill();
        }
        const t = new Node('t').addComponent(Label);
        t.string = `${current}/${max}`;
        t.fontSize = 9;
        t.color = new Color(255, 255, 255, 220);
        t.horizontalAlign = Label.HorizontalAlign.CENTER;
        t.node.addComponent(UITransform).setContentSize(w, 10);
        bar.addChild(t.node);
        return bar;
    }

    private makeScrollView(parent: Node, x: number, y: number, w: number, h: number): ScrollView {
        const svNode = new Node('sv');
        svNode.setPosition(x, y, 0);
        svNode.addComponent(UITransform).setContentSize(w, h);
        const sv = svNode.addComponent(ScrollView);
        sv.bounceDuration = 0.3;
        sv.horizontal = false;
        sv.vertical = true;
        sv.inertia = true;
        sv.elastic = true;
        const mask = svNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        const mg = svNode.addComponent(Graphics);
        mg.rect(-w / 2, -h / 2, w, h);
        const content = new Node('content');
        content.addComponent(UITransform).setContentSize(w, h);
        sv.content = content;
        svNode.addChild(content);

        const sbNode = new Node('sb');
        sbNode.addComponent(UITransform).setContentSize(6, h);
        sbNode.setPosition(w / 2 - 8, 0, 0);
        const sb = sbNode.addComponent(ScrollBar);
        const handleNode = new Node('h');
        sb.handle = handleNode.addComponent(Sprite);
        handleNode.addComponent(UITransform).setContentSize(6, 50);
        const hg = handleNode.addComponent(Graphics);
        hg.fillColor = new Color(160, 130, 80, 200);
        hg.roundRect(-3, -25, 6, 50, 3);
        hg.fill();
        sbNode.addChild(handleNode);
        sv.verticalScrollBar = sb;
        svNode.addChild(sbNode);

        parent.addChild(svNode);
        return sv;
    }

    private makeBtn(text: string, color: Color, cb: () => void): Node {
        const btn = new Node('btn');
        btn.addComponent(UITransform).setContentSize(80, 40);
        const g = btn.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-40, -20, 80, 40, 8);
        g.fill();
        btn.on(Node.EventType.TOUCH_END, cb, this);
        return btn;
    }

    private registerEvents(): void {
        eventBus.on(GameEvent.TASK_ACCEPTED, () => this.scheduleOnce(() => this.refresh(), 0.1), this);
        eventBus.on(GameEvent.TASK_COMPLETED, () => this.scheduleOnce(() => this.refresh(), 0.1), this);
        eventBus.on(GameEvent.TASK_REWARD_CLAIMED, () => this.scheduleOnce(() => this.refresh(), 0.1), this);
    }

    private unregisterEvents(): void {
        eventBus.off(GameEvent.TASK_ACCEPTED, undefined, this);
        eventBus.off(GameEvent.TASK_COMPLETED, undefined, this);
        eventBus.off(GameEvent.TASK_REWARD_CLAIMED, undefined, this);
    }
}
