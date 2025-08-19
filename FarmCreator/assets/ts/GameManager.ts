import { _decorator, Component, director, find, Node } from 'cc';
import { CropData } from './Crop';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    async onLoad() {
        console.log("GameManager onLoad");

        console.log("MainScene 预加载...");
        director.preloadScene("MainScene", async () => {
            console.log("MainScene 预加载完成");
            console.log("加载资源...");
            await this.initialize();            // 初始化资源
            console.log("资源加载完成，切换到主场景...");
            director.loadScene("MainScene");    // 切换到主场景
        });
    }

    // 初始化资源
    async initialize() {
        // 初始化作物数据
        await CropData.deserializeAll();
    }
}