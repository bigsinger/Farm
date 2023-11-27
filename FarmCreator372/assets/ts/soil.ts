import { _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3, UITransform, UIOpacity, TiledObjectGroup, Sprite, SpriteFrame, } from 'cc';
import { CropNode } from './Crop';
import { Common, common } from './Common';

const { ccclass, property } = _decorator;


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

    private self: Component = null;

    // 位置偏移
    private OffsetX: number = 0;
    private OffsetY: number = 0;

    // 土地上种植的作物
    private crops: CropNode[] = [];

    onLoad() {
        this.self = this;
        this.ContentWidth = this.node.getComponent(UITransform).width;
        this.ContentHeight = this.node.getComponent(UITransform).height;
        this.OffsetX = (this.ContentWidth / 2) - 110;
        this.OffsetY = (this.ContentHeight / 2) - 50;

        this.initLands();
        var gid = this.soilLayer.getTileGIDAt(0, 1);

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

    update (deltaTime: number) {
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
    addCrop(x: number, y: number): void {
        // 创建一个新的精灵节点
        const crop = new CropNode(this.cropAtlas, Common.getRandomNumber(CropIdRange.Low, CropIdRange.High));
        crop.setTilePosition(x, y);

        //设置精灵节点的锚点为中下角
        const cropUITransform = crop.getComponent(UITransform);
        cropUITransform.anchorX = 0.5;
        cropUITransform.anchorY = 0;

        this.node.addChild(crop);
        this.crops.push(crop);

        // 使用修复后的getReleasePos函数设置精灵节点的位置
        const tilePos = this.soilLayer.getPositionAt(x, y);
        crop.setPosition(tilePos.x - this.OffsetX, tilePos.y - this.OffsetY);
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
            this.extendLand(this.ExtendBrandTileX, this.ExtendBrandTileY);
            this.addCrop(this.ExtendBrandTileX, this.ExtendBrandTileY);

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
