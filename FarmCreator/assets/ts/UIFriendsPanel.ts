import { _decorator, Component, Node, Label, Button, Prefab, instantiate, ScrollView, Color, Sprite, UITransform, Vec3, Layout } from 'cc';
import { FriendsSystem } from './FriendsSystem';
import { eventBus, GameEvent } from './EventBus';
import { common } from './Common';

const { ccclass, property } = _decorator;

/**
 * 好友列表面板UI
 * 
 * 功能：
 * - 显示好友列表（头像、名字、等级、在线状态）
 * - 访问好友农场
 * - 送礼给好友
 * - 排序（等级/金币）
 */
@ccclass('UIFriendsPanel')
export class UIFriendsPanel extends Component {

    @property(Node)
    contentNode: Node = null;

    @property(Prefab)
    friendItemPrefab: Prefab = null;

    @property(Label)
    countLabel: Label = null;

    @property(Label)
    onlineCountLabel: Label = null;

    @property(Button)
    closeBtn: Button = null;

    @property(Button)
    sortByLevelBtn: Button = null;

    @property(Button)
    sortByGoldBtn: Button = null;

    private _friendsSystem: FriendsSystem = null;
    private _currentSort: 'default' | 'level' | 'gold' = 'default';

    onLoad() {
        this._friendsSystem = FriendsSystem.getInstance();

        // 关闭按钮
        if (this.closeBtn) {
            this.closeBtn.node.on(Button.EventType.CLICK, this.onCloseClick, this);
        }

        // 排序按钮
        if (this.sortByLevelBtn) {
            this.sortByLevelBtn.node.on(Button.EventType.CLICK, () => this.sortFriends('level'), this);
        }
        if (this.sortByGoldBtn) {
            this.sortByGoldBtn.node.on(Button.EventType.CLICK, () => this.sortFriends('gold'), this);
        }

        // 监听好友事件
        eventBus.on(GameEvent.FRIEND_ADDED, this.onFriendListChanged, this);
        eventBus.on(GameEvent.FRIEND_REMOVED, this.onFriendListChanged, this);
        eventBus.on(GameEvent.FRIEND_VISITED, this.onFriendVisited, this);
    }

    onDestroy() {
        eventBus.off(GameEvent.FRIEND_ADDED, this.onFriendListChanged, this);
        eventBus.off(GameEvent.FRIEND_REMOVED, this.onFriendListChanged, this);
        eventBus.off(GameEvent.FRIEND_VISITED, this.onFriendVisited, this);
    }

    onEnable() {
        this.refreshUI();
    }

    /**
     * 刷新整个UI
     */
    private refreshUI() {
        if (!this._friendsSystem) return;

        const friends = this.getSortedFriends();

        // 更新计数
        if (this.countLabel) {
            this.countLabel.string = `好友: ${friends.length}/${this._friendsSystem.friendCount}`;
        }
        if (this.onlineCountLabel) {
            const onlineCount = friends.filter(f => f.isOnline).length;
            this.onlineCountLabel.string = `在线: ${onlineCount}`;
        }

        // 清空并重建列表
        if (this.contentNode) {
            this.contentNode.removeAllChildren();
            for (const friend of friends) {
                this.createFriendItem(friend);
            }
        }
    }

    /**
     * 获取排序后的好友列表
     */
    private getSortedFriends(): FriendInfo[] {
        if (!this._friendsSystem) return [];
        switch (this._currentSort) {
            case 'level': return this._friendsSystem.getFriendsByLevel();
            case 'gold': return this._friendsSystem.getFriendsByGold();
            default: return this._friendsSystem.getFriends();
        }
    }

    /**
     * 创建单个好友项
     */
    private createFriendItem(friend: FriendInfo) {
        if (this.friendItemPrefab) {
            const node = instantiate(this.friendItemPrefab);
            this.contentNode.addChild(node);
            this.setupFriendItem(node, friend);
        } else {
            this.createFriendItemCode(friend);
        }
    }

    /**
     * 使用预制体设置好友项
     */
    private setupFriendItem(node: Node, friend: FriendInfo) {
        const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
        const levelLabel = node.getChildByName('LevelLabel')?.getComponent(Label);
        const statusLabel = node.getChildByName('StatusLabel')?.getComponent(Label);
        const visitBtn = node.getChildByName('VisitBtn')?.getComponent(Button);
        const giftBtn = node.getChildByName('GiftBtn')?.getComponent(Button);

        if (nameLabel) nameLabel.string = friend.name;
        if (levelLabel) levelLabel.string = `Lv.${friend.level}`;
        if (statusLabel) {
            statusLabel.string = friend.isOnline ? '在线' : '离线';
            statusLabel.color = friend.isOnline ? new Color(0, 200, 0) : new Color(150, 150, 150);
        }

        if (visitBtn) {
            visitBtn.node.on(Button.EventType.CLICK, () => this.onVisitClick(friend.id), this);
            visitBtn.interactable = friend.isOnline;
        }

        if (giftBtn) {
            giftBtn.node.on(Button.EventType.CLICK, () => this.onGiftClick(friend.id), this);
        }
    }

    /**
     * 代码创建好友项（无预制体时使用）
     */
    private createFriendItemCode(friend: FriendInfo) {
        const node = new Node(`Friend_${friend.id}`);
        node.addComponent(UITransform).setContentSize(550, 80);
        this.contentNode.addChild(node);

        // 在线状态指示
        const statusDot = new Node('StatusDot');
        const statusSprite = statusDot.addComponent(Sprite);
        statusDot.setPosition(-250, 0);
        // 简单用颜色区分在线状态
        const statusBg = statusDot.addComponent(UITransform);
        statusBg.setContentSize(12, 12);
        node.addChild(statusDot);

        // 名字
        const nameNode = new Node('Name');
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = friend.name;
        nameLabel.fontSize = 22;
        nameNode.setPosition(-180, 10);
        node.addChild(nameNode);

        // 等级
        const levelNode = new Node('Level');
        const levelLabel = levelNode.addComponent(Label);
        levelLabel.string = `Lv.${friend.level}`;
        levelLabel.fontSize = 16;
        levelLabel.color = new Color(100, 100, 100);
        levelNode.setPosition(-180, -18);
        node.addChild(levelNode);

        // 在线状态文字
        const onlineNode = new Node('Status');
        const onlineLabel = onlineNode.addComponent(Label);
        onlineLabel.string = friend.isOnline ? '在线' : '离线';
        onlineLabel.fontSize = 14;
        onlineLabel.color = friend.isOnline ? new Color(0, 200, 0) : new Color(150, 150, 150);
        onlineNode.setPosition(100, 0);
        node.addChild(onlineNode);

        // 访问按钮
        const visitNode = new Node('VisitBtn');
        visitNode.addComponent(UITransform).setContentSize(70, 35);
        const visitBtn = visitNode.addComponent(Button);
        const visitLabel = new Node('Label');
        const vLabel = visitLabel.addComponent(Label);
        vLabel.string = '访问';
        vLabel.fontSize = 16;
        visitLabel.setParent(visitNode);
        visitNode.setPosition(200, 0);
        visitNode.on(Button.EventType.CLICK, () => this.onVisitClick(friend.id), this);
        node.addChild(visitNode);

        // 送礼按钮
        const giftNode = new Node('GiftBtn');
        giftNode.addComponent(UITransform).setContentSize(70, 35);
        const giftBtn = giftNode.addComponent(Button);
        const giftLabel = new Node('Label');
        const gLabel = giftLabel.addComponent(Label);
        gLabel.string = '送礼';
        gLabel.fontSize = 16;
        giftLabel.setParent(giftNode);
        giftNode.setPosition(280, 0);
        giftNode.on(Button.EventType.CLICK, () => this.onGiftClick(friend.id), this);
        node.addChild(giftNode);
    }

    /**
     * 排序好友
     */
    private sortFriends(sortType: 'level' | 'gold') {
        this._currentSort = sortType;
        this.refreshUI();
    }

    /**
     * 访问好友
     */
    private onVisitClick(friendId: string) {
        common.audioController?.playSoundClick();

        if (this._friendsSystem) {
            const success = this._friendsSystem.visitFriend(friendId);
            if (success) {
                this.showToast('访问成功，获得 5 经验');
            } else {
                this.showToast('访问冷却中，请稍后再试');
            }
        }
    }

    /**
     * 送礼
     */
    private onGiftClick(friendId: string) {
        common.audioController?.playSoundClick();

        if (this._friendsSystem) {
            const success = this._friendsSystem.sendGift(friendId, 'crop', 1);
            if (success) {
                this.showToast('送礼成功，获得 10 经验');
            }
        }
    }

    /**
     * 好友列表变化回调
     */
    private onFriendListChanged(data?: any) {
        this.refreshUI();
    }

    /**
     * 好友访问回调
     */
    private onFriendVisited(data?: any) {
        this.refreshUI();
    }

    /**
     * 关闭按钮
     */
    private onCloseClick() {
        common.audioController?.playSoundClick();
        eventBus.emit(GameEvent.UI_CLOSE, { panel: 'friends' });
        this.node.active = false;
    }

    /**
     * 显示提示
     */
    private showToast(message: string) {
        console.log(`[UIFriendsPanel] ${message}`);
    }
}

/** 好友信息接口（类型定义在 global.d.ts） */
