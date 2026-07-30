import { _decorator, Component, find, Layers, Node } from 'cc';
import { CropData } from './Crop';
import { CurrencySystem } from './CurrencySystem';
import { WarehouseManager } from './WarehouseManager';
import { ExpSystem } from './ExpSystem';
import { eventBus, GameEvent } from './EventBus';

const { ccclass, property } = _decorator;

export enum MarketOrderStatus {
    Active = 1,
    Completed = 2,
    Expired = 3,
}

export interface FarmMarketOrder {
    id: string;
    cropId: number;
    cropName: string;
    requiredCount: number;
    rewardGold: number;
    rewardExp: number;
    status: MarketOrderStatus;
    createdAt: number;
    expiresAt: number;
}

@ccclass('MarketOrderManager')
export class MarketOrderManager extends Component {
    private static _instance: MarketOrderManager = null;

    private _orders: FarmMarketOrder[] = [];
    private readonly STORAGE_KEY = 'farm_market_orders';
    private readonly ORDER_LIFETIME = 24 * 60 * 60 * 1000;
    private readonly DAILY_ORDER_COUNT = 3;

    public static getInstance(): MarketOrderManager {
        if (!MarketOrderManager._instance) {
            MarketOrderManager.ensureInstance();
        }
        return MarketOrderManager._instance;
    }

    public static ensureInstance(): boolean {
        if (MarketOrderManager._instance) return true;

        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[MarketOrderManager] 找不到Canvas节点');
            return false;
        }

        const node = new Node('MarketOrderManager');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.addComponent(MarketOrderManager);
        return MarketOrderManager._instance !== null;
    }

    onLoad() {
        if (MarketOrderManager._instance === null) {
            MarketOrderManager._instance = this;
            this.loadOrders();
            this.refreshOrdersIfNeeded();
            console.log('[MarketOrderManager] 初始化完成');
        } else if (MarketOrderManager._instance !== this) {
            this.destroy();
        }
    }

    onDestroy() {
        if (MarketOrderManager._instance === this) {
            MarketOrderManager._instance = null;
        }
    }

    public getOrders(): FarmMarketOrder[] {
        this.refreshOrdersIfNeeded();
        return this._orders.map(order => ({ ...order }));
    }

    public getActiveOrders(): FarmMarketOrder[] {
        return this.getOrders().filter(order => order.status === MarketOrderStatus.Active);
    }

    public getTimeToRefresh(): number {
        const activeOrders = this._orders.filter(order => order.status === MarketOrderStatus.Active);
        if (activeOrders.length === 0) return 0;
        const nextExpiry = Math.min(...activeOrders.map(order => order.expiresAt));
        return Math.max(0, nextExpiry - Date.now());
    }

    public canComplete(orderId: string): boolean {
        const order = this._orders.find(item => item.id === orderId);
        if (!order || order.status !== MarketOrderStatus.Active) return false;

        const warehouse = WarehouseManager.getInstance();
        return !!warehouse && warehouse.getItemCount(order.cropId) >= order.requiredCount;
    }

    public completeOrder(orderId: string): { success: boolean; message: string; rewardGold?: number; rewardExp?: number } {
        const order = this._orders.find(item => item.id === orderId);
        if (!order || order.status !== MarketOrderStatus.Active) {
            return { success: false, message: '订单不可交付' };
        }

        if (Date.now() >= order.expiresAt) {
            order.status = MarketOrderStatus.Expired;
            this.saveOrders();
            return { success: false, message: '订单已过期' };
        }

        const warehouse = WarehouseManager.getInstance();
        if (!warehouse || warehouse.getItemCount(order.cropId) < order.requiredCount) {
            return { success: false, message: `${order.cropName} 数量不足` };
        }

        if (!warehouse.removeCrop(order.cropId, order.requiredCount, 'market_order')) {
            return { success: false, message: '交付失败，请稍后重试' };
        }

        order.status = MarketOrderStatus.Completed;
        CurrencySystem.getInstance()?.addGold(order.rewardGold);
        ExpSystem.getInstance()?.gainExp(order.rewardExp, `完成订单: ${order.cropName}`);
        this.saveOrders();

        eventBus.emit(GameEvent.MARKET_ORDER_COMPLETED, {
            orderId: order.id,
            cropId: order.cropId,
            cropName: order.cropName,
            count: order.requiredCount,
            rewardGold: order.rewardGold,
            rewardExp: order.rewardExp,
        });

        return {
            success: true,
            message: `订单完成，获得 ${order.rewardGold} 金币`,
            rewardGold: order.rewardGold,
            rewardExp: order.rewardExp,
        };
    }

    public refreshOrders(force: boolean = false): void {
        if (!force && !this.shouldRefreshOrders()) return;
        this._orders = this.generateOrders();
        this.saveOrders();
        eventBus.emit(GameEvent.MARKET_ORDERS_REFRESHED, { orders: this.getOrders() });
    }

    public getSaveData(): any {
        return {
            orders: this._orders,
        };
    }

    public restoreFromSave(data: any): void {
        if (!data) return;
        if (Array.isArray(data.orders)) {
            this._orders = data.orders;
            this.refreshOrdersIfNeeded();
            this.saveOrders();
        }
    }

    private refreshOrdersIfNeeded(): void {
        this.markExpiredOrders();
        if (this.shouldRefreshOrders()) {
            this.refreshOrders(true);
        }
    }

    private shouldRefreshOrders(): boolean {
        const active = this._orders.filter(order => order.status === MarketOrderStatus.Active);
        if (active.length === 0) return true;
        return active.every(order => Date.now() >= order.expiresAt);
    }

    private markExpiredOrders(): void {
        const now = Date.now();
        let changed = false;
        for (const order of this._orders) {
            if (order.status === MarketOrderStatus.Active && now >= order.expiresAt) {
                order.status = MarketOrderStatus.Expired;
                changed = true;
            }
        }
        if (changed) this.saveOrders();
    }

    private generateOrders(): FarmMarketOrder[] {
        const candidates = this.getOrderCandidates();
        const now = Date.now();
        const orders: FarmMarketOrder[] = [];

        for (let i = 0; i < this.DAILY_ORDER_COUNT && candidates.length > 0; i++) {
            const index = Math.floor(Math.random() * candidates.length);
            const crop = candidates.splice(index, 1)[0];
            const difficulty = i + 1;
            const requiredCount = 2 + difficulty + Math.floor(Math.random() * 3);
            const baseValue = Math.max(8, crop.SellPrice || 10) * requiredCount;
            const rewardGold = Math.round(baseValue * (1.25 + difficulty * 0.15));

            orders.push({
                id: `order_${now}_${crop.CropId}_${i}`,
                cropId: crop.CropId,
                cropName: crop.CropName,
                requiredCount,
                rewardGold,
                rewardExp: 8 + requiredCount * 3 + difficulty * 4,
                status: MarketOrderStatus.Active,
                createdAt: now,
                expiresAt: now + this.ORDER_LIFETIME,
            });
        }

        return orders;
    }

    private getOrderCandidates(): CropData[] {
        const crops = CropData.AllCrops.filter(crop => crop.CropId >= 101 && crop.CropId <= 120);
        if (crops.length > 0) return [...crops];

        const fallbackIds = [101, 102, 103];
        return fallbackIds.map(id => {
            const crop = new CropData(0);
            crop.CropId = id;
            crop.CropName = `作物${id}`;
            crop.SellPrice = 15;
            return crop;
        });
    }

    private saveOrders(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._orders));
    }

    private loadOrders(): void {
        const dataStr = localStorage.getItem(this.STORAGE_KEY);
        if (!dataStr) return;

        try {
            const data = JSON.parse(dataStr);
            if (Array.isArray(data)) {
                this._orders = data;
            }
        } catch (error) {
            console.error('[MarketOrderManager] 加载订单失败:', error);
            this._orders = [];
        }
    }
}
