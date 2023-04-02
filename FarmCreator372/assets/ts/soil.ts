import { _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3, UITransform, Layers, TiledObjectGroup, Sprite, SpriteFrame, } from 'cc';
import { Crop } from './Crop';

const { ccclass, property } = _decorator;


// 土地的状态标识
const landStateNothing = 0;
const landStateVirgin = 1;
const landStateDry = 2;
const landStateDryHalf = 3;
const landStateFatHalf = 4;
const landStateFat = 5;


@ccclass('Soil')
export default class Soil extends Component {
    @property(TiledMap)
    mapNode: TiledMap = null;

    @property(TiledLayer)
    soilLayer: TiledLayer = null;

    @property(TiledObjectGroup)
    cropLayer: TiledObjectGroup = null;

    @property(SpriteAtlas)
    cropAtlas: SpriteAtlas = null;


    onLoad() {
        this.initLand();
        var gid = this.soilLayer.getTileGIDAt(0, 1);

        let layer: TiledLayer = this.soilLayer;
        let layerSize = layer.getLayerSize();

        this.initCrops();

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
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
    initCrops():void{
        let layerSize = this.soilLayer.getLayerSize();
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < layerSize.width; col++) {
                this.soilLayer.setTileGIDAt(landStateFat,  col, row,  1);
                this.addCrop(row, col);
            }
        }
    }

    // 在行列处添加植物
    addCrop(row: number, col: number):void{
        // 创建一个新的精灵节点
        const crop = new Crop(this.cropAtlas.getSpriteFrame('crop_101_04'));  //cc.instantiate(this.spritePrefab);
        crop.setCellPosition(row, col);

        //设置精灵节点的锚点为中下角
        const cropUITransform = crop.getComponent(UITransform);
        cropUITransform.anchorX = 0.5;
        cropUITransform.anchorY = 0;

        // 使用修复后的getReleasePos函数设置精灵节点的位置
        //const tilePos = this.soilLayer.getPositionAt(col, row); // 注意该函数的参数顺序是：列，行
        //crop.setPosition(tilePos.x, tilePos.y);
        //this.soilLayer.addUserNode(crop);
        

        //let tile = this.soilLayer.getTiledTileAt(col, row);
        //tile.node.addComponent(Sprite).spriteFrame = this.cropAtlas.getSpriteFrame('crop_101_04');
        this.soilLayer.node.addChild(crop);

        
        // 使用修复后的getReleasePos函数设置精灵节点的位置
        const tilePos = this.soilLayer.getPositionAt(col, row); // 注意该函数的参数顺序是：列，行
        crop.setPosition(tilePos.x, tilePos.y);
    }
    
    
    initLand():void{
        let layerSize = this.soilLayer.getLayerSize();
        console.log("layersize ", layerSize);

        for (let i = 0; i < layerSize.width; i++) {
            for (let j = 0; j < layerSize.height; j++) {
                this.soilLayer.setTileGIDAt(landStateNothing, i, j, 0);
            }
        }
    }
    
}
