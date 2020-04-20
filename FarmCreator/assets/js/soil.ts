import { Crop } from './Crop'

const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.TiledMap)
    mapNode: cc.TiledMap = null;

    @property(cc.TiledLayer)
    tiledLayer: cc.TiledLayer = null;

    @property(cc.SpriteAtlas)
    cropAtlas: cc.SpriteAtlas = null;

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        //this.mapNode = this.node.getComponent(cc.TiledMap);
        //this.tiledLayer = this.mapNode.getLayer('soil layer');    //this.node.getChildByName('soil layer')
        var gid = this.tiledLayer.getTileGIDAt(1, cc.Vec2(0, 1));

        let layer:cc.TiledLayer = this.tiledLayer;
        let layerSize:cc.Size = layer.getLayerSize();

        // TODO：为每个tiled土壤块添加Button组件，实现点击可响应
 
        for(let i = 0;i < layerSize.width;i++){
            for (let j = 0; j < 2; j++) {   //layerSize.height
                layer.setTileGID(5, i, j, 1)
                let gid = layer.getTileGIDAt(i,j);
                let crop:Crop = new Crop(this.cropAtlas.getSpriteFrame('crop_101_04'))
                let pos: cc.Vec2 = this.getReleasePos(i, j)
                crop.setPosition(pos)
                crop.parent = this.node

                crop.on(cc.Node.EventType.TOUCH_START, function (event) {
                    cc.log("TOUCH_START event=", event);
                });
            }
        }
    }

    //start () { }

    //获取坐标瓦片对应所在
    getReleasePos(cellX:number, cellY:number) {
        var cellXCount:number = this.mapNode.getMapSize().width;
        var cellYCount:number = this.mapNode.getMapSize().height;
        var cellWidth:number = this.mapNode.getTileSize().width;
        var cellHeight:number = this.mapNode.getTileSize().height;
        var mapPixWidth:number = cellWidth * cellXCount;
        var mapPixHeight:number = cellHeight * cellYCount;
        // cellX和cellY是tilemap中的单元格。
        var posX:number = 0 + (cellX - cellY) * cellWidth / 2;
        var posY:number = mapPixHeight/2 - (cellX + cellY) * cellHeight / 2;
        //减去瓦片地图的锚点对应坐标系的位置
        posY -= cellHeight / 2 / 2;
        return cc.p(posX,posY);
    },

    //将像素坐标转化为瓦片坐标
    // getTilePos: function(posInPixel) {
    //     var mapSize = this.node.getContentSize();
    //     var tileSize = this.tiledMap.getTileSize();
    //     var x = Math.floor(posInPixel.x / tileSize.width);
    //     var y = Math.floor((mapSize.height - posInPixel.y) / tileSize.height);
    //     return cc.p(x, y);
    // },
    // update (dt) {}
}
