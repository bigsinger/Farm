import { _decorator, SpriteAtlas, resources, Asset, } from 'cc';
import { AudioController } from './AudioController';
const { ccclass, property } = _decorator;

// https://blog.csdn.net/m0_66016308/article/details/129282746
// 全局变量/通用配置
@ccclass('Common')
export class Common {
    // 作物图集
    public cropAtlas: SpriteAtlas = null;

    public audioController: AudioController = null;


    // 随机数 [min, max]
    public static getRandomNumber(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // 现实世界的时间转化为游戏时间：天 -> 分钟
    public static RealTimeToGameTime(day: number): number {
        return day / 60;    // 测试时可以将分母调大，例如：140
    }

    /**
     * @method loadResourceAsync
     * @description 异步加载资源。
     * @param {string} path - 资源路径。
     * @param {typeof Asset | null} type - 资源类型。
     * @returns {Promise<T>} 返回加载的资源。
     */
    public static async loadResourceAsync<T extends Asset>(path: string, type: typeof Asset | null): Promise<any> {
        return new Promise((resolve, reject) => {
            resources.load(path, type, (err, asset) => {
                if (err) {
                    console.error(`资源加载失败 ${path}：`, err);
                    resolve(null);
                    // reject(err);
                } else {
                    resolve(asset);
                }
            });
        });
    }
}
export let common: Common = new Common();


@ccclass('NaturalEnv')
export class NaturalEnv {
    // 气温
    public Temperature: number = 0;

    // 水分
    public Water: number = 0;

    // 养料
    public Fuel: number = 0;

    // 虫害
    public Bug: number = 0;

    // 光照
    public Light: number = 0;

    // 风力
    public Wind: number = 0;
}