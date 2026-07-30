import { _decorator, Component, Node, Label, Color, Graphics, UITransform, Size, Vec3, tween, UIOpacity } from 'cc';
import { ExpSystem } from './ExpSystem';
import { eventBus, GameEvent } from './EventBus';
const { ccclass, property } = _decorator;

/**
 * 经验条HUD — 主界面左上角显示等级和经验进度
 * 监听 EXP_GAINED / LEVEL_UP 事件自动更新
 * 升级时有闪烁+弹跳特效
 */
@ccclass('UIExpBar')
export class UIExpBar extends Component {

    @property
    barWidth: number = 260;

    @property
    barHeight: number = 28;

    private _levelLabel: Label = null;
    private _expLabel: Label = null;
    private _expSystem: ExpSystem = null;
    private _barFill: Graphics = null;
    private _barNode: Node = null;

    onLoad() {
        this._expSystem = ExpSystem.getInstance();
        this.buildUI();
        this.registerEvents();
        this.refresh();
    }

    onDestroy() {
        this.unregisterEvents();
    }

    private buildUI(): void {
        const W = this.barWidth;
        const H = this.barHeight;

        // 背景条
        const bgNode = new Node('bgBar');
        const bgUI = bgNode.addComponent(UITransform);
        bgUI.setContentSize(W, H);
        const bgGfx = bgNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(20, 18, 15, 220);
        bgGfx.roundRect(-W / 2, -H / 2, W, H, H / 2);
        bgGfx.fill();
        bgGfx.strokeColor = new Color(80, 70, 50, 200);
        bgGfx.lineWidth = 1.5;
        bgGfx.stroke();
        this.node.addChild(bgNode);

        // 经验填充条
        this._barNode = new Node('fillBar');
        const barUI = this._barNode.addComponent(UITransform);
        barUI.setContentSize(0, H - 4);
        this._barNode.setPosition(-W / 2 + 2, 0, 0);
        barUI.setAnchorPoint(0, 0.5);
        this._barFill = this._barNode.addComponent(Graphics);
        this.node.addChild(this._barNode);

        // 等级标签（左侧圆形容器）
        const lvContainer = new Node('lvContainer');
        const lvContUI = lvContainer.addComponent(UITransform);
        lvContUI.setContentSize(H + 8, H + 8);
        lvContainer.setPosition(-W / 2 - H / 2 - 6, 0, 0);
        const lvGfx = lvContainer.addComponent(Graphics);
        lvGfx.fillColor = new Color(255, 152, 0, 255);
        lvGfx.circle(0, 0, H / 2 + 2);
        lvGfx.fill();
        lvGfx.strokeColor = new Color(255, 200, 100, 255);
        lvGfx.lineWidth = 2;
        lvGfx.stroke();
        this.node.addChild(lvContainer);

        this._levelLabel = new Node('levelLabel').addComponent(Label);
        this._levelLabel.fontSize = 16;
        this._levelLabel.color = new Color(255, 255, 255);
        this._levelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const lvUI = this._levelLabel.node.addComponent(UITransform);
        lvUI.setContentSize(H + 8, H + 8);
        lvContainer.addChild(this._levelLabel.node);

        // 经验文字（进度条右侧）
        this._expLabel = new Node('expLabel').addComponent(Label);
        this._expLabel.fontSize = 12;
        this._expLabel.color = new Color(200, 200, 180);
        this._expLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        const expUI = this._expLabel.node.addComponent(UITransform);
        expUI.setContentSize(W, H);
        this._expLabel.node.setPosition(0, 0, 1);
        this.node.addChild(this._expLabel.node);
    }

    private registerEvents(): void {
        eventBus.on(GameEvent.EXP_GAINED, this.onExpGained, this);
        eventBus.on(GameEvent.LEVEL_UP, this.onLevelUp, this);
    }

    private unregisterEvents(): void {
        eventBus.off(GameEvent.EXP_GAINED, this.onExpGained, this);
        eventBus.off(GameEvent.LEVEL_UP, this.onLevelUp, this);
    }

    private onExpGained(data: any): void {
        this.refresh();
    }

    private onLevelUp(data: any): void {
        this.playLevelUpEffect();
        this.refresh();
    }

    /** 刷新显示 */
    public refresh(): void {
        if (!this._expSystem || !this._levelLabel || !this._expLabel) return;

        const data = this._expSystem.getPlayerData();
        this._levelLabel.string = `Lv${data.level}`;

        const ratio = data.expToNextLevel > 0
            ? Math.min(data.currentExp / data.expToNextLevel, 1)
            : 1;
        this._expLabel.string = `${data.currentExp} / ${data.expToNextLevel}`;

        // 更新填充条
        if (this._barFill && this._barNode) {
            const fillW = (this.barWidth - 4) * ratio;
            this._barFill.clear();
            if (fillW > 0) {
                // 渐变效果：深橙 → 浅橙
                this._barFill.fillColor = new Color(255, 140, 0, 230);
                this._barFill.roundRect(0, -(this.barHeight - 4) / 2, fillW, this.barHeight - 4, (this.barHeight - 4) / 2);
                this._barFill.fill();
            }

            const barUI = this._barNode.getComponent(UITransform);
            if (barUI) barUI.setContentSize(fillW, this.barHeight - 4);
        }
    }

    /** 升级特效 — 闪烁+弹跳 */
    private playLevelUpEffect(): void {
        const node = this.node;
        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);

        tween(opacity)
            .to(0.1, { opacity: 100 })
            .to(0.1, { opacity: 255 })
            .to(0.1, { opacity: 100 })
            .to(0.1, { opacity: 255 })
            .start();

        tween(node)
            .to(0.15, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backIn' })
            .start();
    }
}
