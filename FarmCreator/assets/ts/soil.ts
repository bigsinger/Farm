import { _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3, UITransform, UIOpacity, TiledObjectGroup, AudioClip, SpriteFrame, } from 'cc';
import { CropNode, CropIdRange, CropData } from './Crop';
import { Common, common } from './Common';
import { CurrencySystem } from './CurrencySystem';
import { ShopManager } from './ShopManager';
import { eventBus, GameEvent } from './EventBus';

const { ccclass, property } = _decorator;


////////////////////////////////////////////////////////////////
// 土地相关
////////////////////////////////////////////////////////////////
// 土地的状态标识
enum LandState {
    Nothing = 0,
    Virgin = 1,
    Dry = 2,
    DryHalf = 3,
    FatHalf = 4,
    Fat = 5,
}

// 默认初始化作物的行数
const YCountOfCrops = 2;

////////////////////////////////////////////////////////////////


@ccclass('Soil')
export class Soil extends Component {
    @property(TiledMap)
    mapNode: TiledMap = null;

    @property(TiledLayer)
    soilLayer: TiledLayer = null;

    @property(TiledObjectGroup)
    cropLayer: TiledObjectGroup = null;

    @property(SpriteAtlas)
    cropAtlas: SpriteAtlas = null;

    // 扩建牌
    @property({ type: Node })
    extendBrand: Node = null;

    // 尺寸
    private ContentWidth: number = 0;
    private ContentHeight: number = 0;

    // 土地行列数
    private WidthCount: number = 0;
    private HeightCount: number = 0;

    // 扩建牌所在土地的位置序号
    private ExtendBrandTileX: number = 0;
    private ExtendBrandTileY: number = 0;


    // 位置偏移
    private OffsetX: number = 0;
    private OffsetY: number = 0;

    // 土地上种植的作物
    private crops: CropNode[] = [];

    // ==================== 存档相关 ====================

    /**
     * 获取所有作物的存档数据
     */
    public getCropsSaveData(): any[] {
        const data: any[] = [];
        for (const crop of this.crops) {
            if (crop.crop) {
                data.push({
                    cropId: crop.crop.CropId,
                    tileX: crop.TilePosX,
                    tileY: crop.TilePosY,
                    plantTime: crop.PlantTime,
                    currentLifecycleIndex: crop.CurrentLifecycleIndex,
                    currentLifecycleStartTime: crop.CurrentLifecycleStartTime,
                    currentLifecycleGrowTime: crop.CurrentLifecycleGrowTime,
                    harvestTimes: crop.HarvestTimes,
                });
            }
        }
        return data;
    }

    /**
     * 获取扩建牌位置存档数据
     */
    public getExtendBrandSaveData(): { tileX: number; tileY: number } {
        return {
            tileX: this.ExtendBrandTileX,
            tileY: this.ExtendBrandTileY,
        };
    }

    /**
     * 从存档恢复扩建牌位置
     */
    public restoreExtendBrandFromSave(data: { tileX: number; tileY: number }): void {
        if (data) {
            this.ExtendBrandTileX = data.tileX || 0;
            this.ExtendBrandTileY = data.tileY || YCountOfCrops;
            this.setExtendBrandPosition();
            console.log(`[Soil] 扩建牌位置恢复: (${this.ExtendBrandTileX}, ${this.ExtendBrandTileY})`);
        }
    }

    /**
     * 从存档数据恢复作物
     */
    public restoreCropsFromSave(cropsData: any[]): void {
        if (!cropsData || cropsData.length === 0) return;

        // 清除现有作物
        for (const crop of this.crops) {
            crop.destroy();
        }
        this.crops = [];

        // 从存档恢复
        for (const data of cropsData) {
            const cropNode = new CropNode(this.cropAtlas, data.cropId);
            if (!cropNode.crop) continue;

            cropNode.TilePosX = data.tileX;
            cropNode.TilePosY = data.tileY;
            cropNode.PlantTime = data.plantTime;
            cropNode.CurrentLifecycleIndex = data.currentLifecycleIndex;
            cropNode.CurrentLifecycleStartTime = data.currentLifecycleStartTime;
            cropNode.CurrentLifecycleGrowTime = data.currentLifecycleGrowTime || 0;
            cropNode.HarvestTimes = data.harvestTimes || 0;

            // 设置位置
            const cropUITransform = cropNode.getComponent(UITransform);
            cropUITransform.anchorX = 0.5;
            cropUITransform.anchorY = 0;

            this.node.addChild(cropNode);
            this.crops.push(cropNode);

            const tilePos = this.soilLayer.getPositionAt(data.tileX, data.tileY);
            cropNode.setPosition(tilePos.x - this.OffsetX, tilePos.y - this.OffsetY);

            // 更新精灵到对应生长阶段
            cropNode.updateSpriteFrame();
        }

        console.log(`[Soil] 从存档恢复 ${cropsData.length} 个作物`);
    }

    onLoad() {
        //////////////////////////////////
        // 学习测试用的隐藏掉
        var cropLayer = this.node.getChildByName("cropLayer");
        if (cropLayer) {
            const uiOpacity = cropLayer.getComponent(UIOpacity) || cropLayer.addComponent(UIOpacity);
            uiOpacity.opacity = 0;
            cropLayer.active = false;
        }
        //////////////////////////////////

        common.cropAtlas = this.cropAtlas;
        this.ContentWidth = this.node.getComponent(UITransform).width;
        this.ContentHeight = this.node.getComponent(UITransform).height;

        this.OffsetX = (this.ContentWidth - this.mapNode.getTileSize().x) / 2;
        this.OffsetY = (this.ContentHeight - this.mapNode.getTileSize().y) / 2;

        this.initLands();
        //var gid = this.soilLayer.getTileGIDAt(0, 1);

        let layer: TiledLayer = this.soilLayer;
        let layerSize = layer.getLayerSize();
        this.WidthCount = layerSize.width;
        this.HeightCount = layerSize.height;

        // 初始化扩建牌
        this.ExtendBrandTileX = 0;
        this.ExtendBrandTileY = YCountOfCrops;
        this.initExtendBrand();

        this.initCrops();

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    update(deltaTime: number) {
        for (let i = 0; i < this.crops.length; i++) {
            this.crops[i].onGrowing(null, deltaTime);
        }
    }

    onTouchStart(event) {
        // 获取点击位置
        const clickPos = event.getLocation();
        const uiTransform = this.mapNode.node.getComponent(UITransform);
        const localClickPos = uiTransform.convertToNodeSpaceAR(new Vec3(clickPos.x, clickPos.y, 0));


        // 将点击位置转换为瓦块坐标
        const tilePos = this.getTilePos(localClickPos);

        console.log(`点击的瓦块坐标为: (${tilePos.x}, ${tilePos.y})`);
    }

    getTilePos(localClickPos: Vec3): Vec2 {
        const tileSize = this.mapNode.getTileSize();
        const layerSize = this.soilLayer.getLayerSize();

        const x = (localClickPos.x - this.mapNode.node.getPosition().x) / tileSize.x;
        const y = (this.mapNode.node.getPosition().y - localClickPos.y) / tileSize.y;

        const tileX = Math.floor((layerSize.height - y + x) / 2);
        const tileY = Math.floor((layerSize.height - y - x) / 2);

        return new Vec2(tileX, tileY);
    }

    // 初始化植物
    initCrops(): void {
        let layerSize = this.soilLayer.getLayerSize();
        for (let x = 0; x < layerSize.width; x++) {
            for (let y = 0; y < YCountOfCrops; y++) {
                this.extendLand(x, y);
                this.addCrop(x, y);
            }
        }
    }

    // 在行列处添加植物
    addCrop(x: number, y: number, cropId?: number, chargeSeed: boolean = true): boolean {
        // 如果指定了作物ID，检查是否有足够金币购买种子
        if (cropId !== undefined && chargeSeed) {
            const currencySystem = CurrencySystem.getInstance();
            if (!currencySystem) {
                console.warn('[Soil] 货币系统未初始化');
                return false;
            }
            
            // 查找作物种子价格
            const cropData = CropData.AllCrops.find(c => c.CropId === cropId);
            const seedPrice = cropData ? cropData.SeedPrice : 10;
            
            if (!currencySystem.canAfford(seedPrice)) {
                console.warn(`[Soil] 金币不足，无法种植 ${cropData ? cropData.CropName : '未知作物'}`);
                return false;
            }
            
            // 扣除种子费用
            if (!currencySystem.spendGold(seedPrice)) {
                console.warn('[Soil] 扣除金币失败');
                return false;
            }
            
            console.log(`[Soil] 种植作物花费 ${seedPrice} 金币`);
        }
        
        // 创建一个新的精灵节点
        const finalCropId = cropId !== undefined ? cropId : Common.getRandomNumber(CropIdRange.Low, CropIdRange.High);
        const cropNode = new CropNode(this.cropAtlas, finalCropId);
        if (cropNode.crop == null) {
            return false;
        }

        cropNode.setTilePosition(x, y);

        //设置精灵节点的锚点为中下角
        const cropUITransform = cropNode.getComponent(UITransform);
        cropUITransform.anchorX = 0.5;
        cropUITransform.anchorY = 0;

        this.node.addChild(cropNode);
        this.crops.push(cropNode);

        // 使用修复后的getReleasePos函数设置精灵节点的位置
        const tilePos = this.soilLayer.getPositionAt(x, y);
        cropNode.setPosition(tilePos.x - this.OffsetX, tilePos.y - this.OffsetY);

        // 发送种植事件
        eventBus.emit(GameEvent.CROP_PLANTED, {
            cropId: finalCropId,
            cropName: cropNode.crop?.CropName || '',
            position: { x: cropNode.position.x, y: cropNode.position.y },
            tile: { x, y },
        });

        return true;
    }

    // 初始化土地
    initLands(): void {
        let layerSize = this.soilLayer.getLayerSize();
        console.log("layersize ", layerSize);

        for (let i = 0; i < layerSize.width; i++) {
            for (let j = 0; j < layerSize.height; j++) {
                this.initLand(i, j);
            }
        }
    }

    // 初始化土地
    initLand(x: number, y: number): void {
        this.soilLayer.setTileGIDAt(LandState.Nothing, x, y, 0);
    }

    // 扩建土地
    extendLand(x: number, y: number): void {
        console.log("扩建土地：", x, y);
        this.soilLayer.setTileGIDAt(LandState.Fat, x, y, 1);
        this.soilLayer.markForUpdateRenderData();
    }

    // 初始化土地上的扩建牌
    initExtendBrand(): void {
        //设置精灵节点的锚点为中下角
        const cropUITransform = this.extendBrand.getComponent(UITransform);
        cropUITransform.anchorX = 0.5;
        cropUITransform.anchorY = 0;

        this.extendBrand.on(Node.EventType.TOUCH_START, this.onTouchExtendBrand, this);
        this.setExtendBrandPosition();
    }

    // 设置扩建牌的位置
    setExtendBrandPosition(): void {
        const uiOpacity = this.extendBrand.getComponent(UIOpacity) || this.extendBrand.addComponent(UIOpacity);

        if (this.ExtendBrandTileX < this.WidthCount && this.ExtendBrandTileY < this.HeightCount) {
            const tilePos = this.soilLayer.getPositionAt(this.ExtendBrandTileX, this.ExtendBrandTileY);
            this.extendBrand.setPosition(tilePos.x - this.OffsetX, tilePos.y - this.OffsetY);
            uiOpacity.opacity = 255;
            this.extendBrand.active = true;
        } else {
            uiOpacity.opacity = 0;
            this.extendBrand.active = false;
        }
    }

    // 点击扩建牌处理事件
    onTouchExtendBrand(event: Event) {
        if (this.ExtendBrandTileX < this.WidthCount && this.ExtendBrandTileY < this.HeightCount) {
            common.audioController.playSoundExtand();  // 播放扩建音效

            this.extendLand(this.ExtendBrandTileX, this.ExtendBrandTileY);

            const shopManager = ShopManager.getInstance();
            const selectedSeedId = shopManager?.getSelectedSeedCropId();
            const hasSeed = selectedSeedId && shopManager.getSeedCount(selectedSeedId) > 0;
            if (hasSeed) {
                shopManager.consumeSeed(selectedSeedId, 1);
                this.addCrop(this.ExtendBrandTileX, this.ExtendBrandTileY, selectedSeedId, false);
                console.log(`[Soil] 使用已购买种子播种: ${selectedSeedId}`);
            } else {
                this.addCrop(this.ExtendBrandTileX, this.ExtendBrandTileY);
            }

            this.ExtendBrandTileX++;
            if (this.ExtendBrandTileX >= this.WidthCount) {
                this.ExtendBrandTileX = 0;
                this.ExtendBrandTileY++;
            }
        } else {
            console.log("全部扩建完毕");
        }
        this.setExtendBrandPosition();
    }

}
