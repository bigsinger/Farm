import { _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3, UITransform, Layers } from 'cc';
import { Crop } from './Crop';

const { ccclass, property } = _decorator;

@ccclass('NewClass')
export default class NewClass extends Component {
    @property(TiledMap)
    mapNode: TiledMap = null;

    @property(TiledLayer)
    tiledLayer: TiledLayer = null;

    @property(SpriteAtlas)
    cropAtlas: SpriteAtlas = null;


    onLoad() {
        var gid = this.tiledLayer.getTileGIDAt(0, 1);

        let layer: TiledLayer = this.tiledLayer;
        let layerSize = layer.getLayerSize();
        console.log("layersize ", layerSize);

        for (let i = 0; i < layerSize.width; i++) {
            for (let j = 0; j < 2; j++) {
                layer.setTileGIDAt(5, i, j, 1);
                let gid = layer.getTileGIDAt(i, j);
                let crop = new Crop(this.cropAtlas.getSpriteFrame('crop_101_04'));
                crop.setCellPosition(i, j);
                this.node.addChild(crop);
                let pos: Vec3 = this.getReleasePos(i, j);
                crop.setPosition(pos);

                // Add a transparent node for detecting tile clicks
                const tileNode = new Node();
                this.node.addChild(tileNode);
                tileNode.addComponent(UITransform).setContentSize(this.mapNode.getTileSize());
                tileNode.setPosition(pos);

                tileNode.on(Node.EventType.TOUCH_START, () => {
                    console.log(`Tile TOUCH_START tile: (${i}, ${j}) ; xyz: (${tileNode.position.x}, ${tileNode.position.y}, ${tileNode.position.z})`);
                });

                console.log(`crop world position: ${crop.getWorldPosition()}`);
                console.log(`tileNode world position: ${tileNode.getWorldPosition()}`);
            }
        }
    }
    
    getReleasePos(cellX: number, cellY: number): Vec3 {
        let tileSize = this.mapNode.getTileSize();
        let mapSize = this.mapNode.getMapSize();
    
        let x = (cellX - cellY) * tileSize.width / 2;
        let y = (mapSize.height - cellX - cellY - 1) * tileSize.height / 2;
    
        return new Vec3(x, y, 0);
    }
    
    
    
    
}
