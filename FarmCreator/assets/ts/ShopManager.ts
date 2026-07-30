import { _decorator, Component, resources, JsonAsset, find, Node, Layers } from 'cc';
import { CurrencySystem } from './CurrencySystem';
import { eventBus, GameEvent } from './EventBus';
const { ccclass } = _decorator;

/**
 * 商店商品数据
 */
export interface ShopItem {
    /** 作物ID */
    cropId: number;
    /** 作物名称 */
    cropName: string;
    /** 种子价格 */
    seedPrice: number;
    /** 成熟时间（天） */
    matureTime: number;
    /** 售卖价格 */
    sellPrice: number;
    /** 是否已解锁 */
    unlocked: boolean;
    /** 解锁等级 */
    unlockLevel: number;
}

/**
 * 购买结果
 */
export interface BuyResult {
    success: boolean;
    message: string;
    remainingGold?: number;
}

/**
 * 商店管理器 - 管理种子购买
 * 支持查看商品、购买种子、解锁商品等功能
 */
@ccclass('ShopManager')
export class ShopManager extends Component {
    private static _instance: ShopManager | null = null;
    
    /** 商品列表 */
    private _items: Map<number, ShopItem> = new Map();
    
    /** 是否已初始化 */
    private _initialized: boolean = false;

    /** 已购买但尚未播种的种子库存 */
    private _seedInventory: Map<number, number> = new Map();

    /** 下一块新土地优先播种的作物 */
    private _selectedSeedCropId: number = 101;

    private _pendingSaveData: any = null;

    private readonly SEED_INVENTORY_KEY = 'farm_seed_inventory';
    private readonly SELECTED_SEED_KEY = 'farm_selected_seed';
    
    public static getInstance(): ShopManager {
        // 如果实例不存在，尝试自动创建
        if (!ShopManager._instance) {
            ShopManager.ensureInstance();
        }
        return ShopManager._instance;
    }

    /**
     * 确保ShopManager实例存在（自动创建）
     */
    public static ensureInstance(): boolean {
        if (ShopManager._instance) {
            return true;
        }

        console.log('[ShopManager] 自动创建ShopManager节点');
        
        // 获取Canvas
        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[ShopManager] 找不到Canvas节点，无法创建ShopManager');
            return false;
        }

        // 创建ShopManager节点
        const shopManagerNode = new Node('ShopManager');
        shopManagerNode.layer = Layers.Enum.UI_2D;
        shopManagerNode.parent = canvas;

        // 添加ShopManager组件（这会触发onLoad）
        shopManagerNode.addComponent(ShopManager);
        
        console.log('[ShopManager] ShopManager节点创建完成');

        return ShopManager._instance !== null;
    }
    
    onLoad() {
        if (ShopManager._instance === null) {
            ShopManager._instance = this;
            this.loadSeedInventory();
            this.loadShopData();
            this._registerEvents();
        } else if (ShopManager._instance !== this) {
            // 管理器使用专用节点，重复实例连同节点一起移除。
            this.node.destroy();
        }
    }
    
    onDestroy() {
        if (ShopManager._instance === this) {
            this._unregisterEvents();
            ShopManager._instance = null;
        }
    }

    private _registerEvents(): void {
        eventBus.on(GameEvent.LEVEL_UP, this._onLevelUp, this);
    }

    private _unregisterEvents(): void {
        eventBus.off(GameEvent.LEVEL_UP, this._onLevelUp, this);
    }

    /** 玩家升级时自动解锁对应等级的商品 */
    private _onLevelUp(data: any): void {
        const level = data?.level || data?.newLevel || 0;
        if (level > 0) {
            this.unlockByLevel(level);
        }
    }
    
    /**
     * 加载商店数据
     */
    private loadShopData(): void {
        resources.load('data/crops', JsonAsset, (err, asset) => {
            if (err) {
                console.error('[ShopManager] 加载作物数据失败:', err);
                return;
            }
            
            try {
                const cropsData = asset.json as any[];
                if (!Array.isArray(cropsData)) {
                    throw new Error('作物配置必须是数组');
                }
                this._items.clear();
                for (const crop of cropsData) {
                    // 计算成熟时间（所有阶段time之和）
                    let matureTime = 0;
                    if (crop.lifecycle && Array.isArray(crop.lifecycle)) {
                        for (const stage of crop.lifecycle) {
                            matureTime += stage.time || 0;
                        }
                    }
                    
                    const shopItem: ShopItem = {
                        cropId: crop.id,
                        cropName: crop.name,
                        seedPrice: crop.seedPrice || 10,
                        matureTime: matureTime,
                        sellPrice: crop.sellPrice || 20,
                        unlocked: this.calculateUnlockStatus(crop.id),
                        unlockLevel: this.calculateUnlockLevel(crop.id)
                    };
                    
                    this._items.set(crop.id, shopItem);
                }
                
                this._initialized = true;
                if (this._pendingSaveData) {
                    const pending = this._pendingSaveData;
                    this._pendingSaveData = null;
                    this.restoreFromSave(pending);
                }
                console.log(`[ShopManager] 商店数据加载完成: ${this._items.size} 种商品`);
            } catch (error) {
                console.error('[ShopManager] 解析商店数据失败:', error);
            }
        });
    }
    
    /**
     * 计算解锁状态（基础作物默认解锁）
     */
    private calculateUnlockStatus(cropId: number): boolean {
        // ID 101-107 为基础作物，默认解锁
        return cropId >= 101 && cropId <= 107;
    }
    
    /**
     * 计算解锁等级
     */
    private calculateUnlockLevel(cropId: number): number {
        // 根据种子价格设定解锁等级
        if (cropId >= 101 && cropId <= 107) return 1;
        if (cropId >= 108 && cropId <= 111) return 2;
        if (cropId >= 112 && cropId <= 115) return 3;
        return 5;
    }
    
    /**
     * 检查商店数据是否已加载完成
     */
    public isDataReady(): boolean {
        return this._initialized;
    }

    /**
     * 获取所有商品
     */
    public getAllItems(): ShopItem[] {
        return Array.from(this._items.values());
    }
    
    /**
     * 获取已解锁的商品
     */
    public getUnlockedItems(): ShopItem[] {
        return this.getAllItems().filter(item => item.unlocked);
    }
    
    /**
     * 获取未解锁的商品
     */
    public getLockedItems(): ShopItem[] {
        return this.getAllItems().filter(item => !item.unlocked);
    }
    
    /**
     * 获取指定商品
     */
    public getItem(cropId: number): ShopItem | null {
        return this._items.get(cropId) || null;
    }
    
    /**
     * 购买种子
     * @param cropId 作物ID
     * @param quantity 数量（默认1）
     * @returns 购买结果
     */
    public buySeed(cropId: number, quantity: number = 1): BuyResult {
        if (!this._initialized) {
            return { success: false, message: '商店数据正在加载中，请稍后重试' };
        }
        
        const item = this._items.get(cropId);
        if (!item) {
            return { success: false, message: '商品不存在' };
        }
        
        if (!item.unlocked) {
            return { success: false, message: `该作物需要等级 ${item.unlockLevel} 才能解锁` };
        }
        
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return { success: false, message: '购买数量必须是正整数' };
        }
        
        const totalPrice = item.seedPrice * quantity;
        const currencySystem = CurrencySystem.getInstance();
        
        if (!currencySystem) {
            return { success: false, message: '货币系统未初始化' };
        }
        
        if (!currencySystem.canAfford(totalPrice)) {
            return { 
                success: false, 
                message: `金币不足，需要 ${totalPrice} 金币，当前拥有 ${currencySystem.gold} 金币` 
            };
        }
        
        // 执行购买
        if (currencySystem.spendGold(totalPrice)) {
            const remainingGold = currencySystem.gold;
            this.addSeed(cropId, quantity);
            this.selectSeed(cropId);
            console.log(`[ShopManager] 购买成功: ${item.cropName} 种子 x${quantity}, 花费 ${totalPrice} 金币`);
            
            // 触发购买成功事件
            this.node.emit('seed-purchased', {
                cropId: cropId,
                cropName: item.cropName,
                quantity: quantity,
                totalPrice: totalPrice,
                seedCount: this.getSeedCount(cropId),
            });
            // 通过EventBus全局发布
            eventBus.emit(GameEvent.SHOP_ITEM_BOUGHT, {
                cropId: cropId,
                cropName: item.cropName,
                quantity: quantity,
                totalPrice: totalPrice,
                seedCount: this.getSeedCount(cropId),
            });
            
            return { 
                success: true, 
                message: `成功购买 ${item.cropName} 种子 x${quantity}`,
                remainingGold: remainingGold
            };
        }
        
        return { success: false, message: '购买失败，请重试' };
    }
    
    /**
     * 检查是否可以购买
     */
    public canBuy(cropId: number, quantity: number = 1): boolean {
        const item = this._items.get(cropId);
        if (!item || !item.unlocked) return false;
        
        const currencySystem = CurrencySystem.getInstance();
        if (!currencySystem) return false;
        
        return currencySystem.canAfford(item.seedPrice * quantity);
    }
    
    /**
     * 解锁商品
     * @param cropId 作物ID
     * @returns 是否解锁成功
     */
    public unlockItem(cropId: number): boolean {
        const item = this._items.get(cropId);
        if (!item) {
            console.warn(`[ShopManager] 商品不存在: ${cropId}`);
            return false;
        }
        
        if (item.unlocked) {
            console.log(`[ShopManager] 商品已解锁: ${item.cropName}`);
            return true;
        }
        
        item.unlocked = true;
        console.log(`[ShopManager] 商品解锁成功: ${item.cropName}`);
        this.node.emit('item-unlocked', item);
        eventBus.emit(GameEvent.SHOP_UNLOCKED, { cropId: item.cropId, cropName: item.cropName });
        return true;
    }
    
    /**
     * 根据等级解锁商品
     * @param level 玩家等级
     */
    public unlockByLevel(level: number): void {
        let unlockedCount = 0;
        for (const item of this._items.values()) {
            if (!item.unlocked && item.unlockLevel <= level) {
                item.unlocked = true;
                unlockedCount++;
                console.log(`[ShopManager] 等级解锁: ${item.cropName} (等级 ${level})`);
            }
        }
        
        if (unlockedCount > 0) {
            this.node.emit('items-unlocked-by-level', level);
            eventBus.emit(GameEvent.SHOP_UNLOCKED, { level, count: unlockedCount });
        }
    }

    public getSeedCount(cropId: number): number {
        return this._seedInventory.get(cropId) || 0;
    }

    public getSelectedSeedCropId(): number {
        return this._selectedSeedCropId;
    }

    public selectSeed(cropId: number): boolean {
        if (!this._items.has(cropId) && this._initialized) {
            return false;
        }
        this._selectedSeedCropId = cropId;
        localStorage.setItem(this.SELECTED_SEED_KEY, cropId.toString());
        return true;
    }

    public consumeSeed(cropId: number, quantity: number = 1): boolean {
        const current = this.getSeedCount(cropId);
        if (quantity <= 0 || current < quantity) return false;

        const next = current - quantity;
        if (next <= 0) {
            this._seedInventory.delete(cropId);
        } else {
            this._seedInventory.set(cropId, next);
        }
        this.saveSeedInventory();
        return true;
    }

    public getSaveData(): any {
        return {
            seedInventory: Array.from(this._seedInventory.entries()),
            selectedSeedCropId: this._selectedSeedCropId,
            unlockedCropIds: this.getUnlockedItems().map(item => item.cropId),
        };
    }

    public restoreFromSave(data: any): void {
        if (!data) return;
        if (!this._initialized) {
            // 商品配置异步加载完成前先暂存；此时不能提前写回本地缓存，
            // 否则可能用一份尚未校验的存档覆盖当前有效数据。
            this._pendingSaveData = data;
            return;
        }

        this._seedInventory.clear();
        if (Array.isArray(data.seedInventory)) {
            for (const [cropId, count] of data.seedInventory) {
                const parsedCropId = Number(cropId);
                const parsedCount = Number(count);
                if (Number.isInteger(parsedCropId) && Number.isInteger(parsedCount) && parsedCount > 0) {
                    this._seedInventory.set(parsedCropId, parsedCount);
                }
            }
        }

        if (data.selectedSeedCropId > 0) {
            this._selectedSeedCropId = data.selectedSeedCropId;
        }

        if (Array.isArray(data.unlockedCropIds)) {
            for (const cropId of data.unlockedCropIds) {
                const item = this._items.get(Number(cropId));
                if (item) item.unlocked = true;
            }
        }

        this.saveSeedInventory();
        localStorage.setItem(this.SELECTED_SEED_KEY, this._selectedSeedCropId.toString());
        console.log(`[ShopManager] 从存档恢复种子库存: ${this._seedInventory.size} 种`);
    }

    private addSeed(cropId: number, quantity: number): void {
        const current = this.getSeedCount(cropId);
        this._seedInventory.set(cropId, current + quantity);
        this.saveSeedInventory();
    }

    private saveSeedInventory(): void {
        const data = Array.from(this._seedInventory.entries());
        localStorage.setItem(this.SEED_INVENTORY_KEY, JSON.stringify(data));
    }

    private loadSeedInventory(): void {
        const dataStr = localStorage.getItem(this.SEED_INVENTORY_KEY);
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                if (Array.isArray(data)) {
                    for (const [cropId, count] of data) {
                        const parsedCropId = Number(cropId);
                        const parsedCount = Number(count);
                        if (Number.isInteger(parsedCropId) && Number.isInteger(parsedCount) && parsedCount > 0) {
                            this._seedInventory.set(parsedCropId, parsedCount);
                        }
                    }
                }
            } catch (error) {
                console.error('[ShopManager] 加载种子库存失败:', error);
            }
        }

        const selected = parseInt(localStorage.getItem(this.SELECTED_SEED_KEY) || '', 10);
        if (selected > 0) {
            this._selectedSeedCropId = selected;
        }
    }
    
    /**
     * 获取商品数量
     */
    public getItemCount(): number {
        return this._items.size;
    }
    
    /**
     * 获取已解锁商品数量
     */
    public getUnlockedCount(): number {
        return this.getUnlockedItems().length;
    }
}
