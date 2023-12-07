// AudioController.ts

import { AudioClip, AudioSource, Component, _decorator, resources, error } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;


@ccclass("AudioController")
export class AudioController extends Component {
    // 背景音乐
    @property(AudioSource)
    public backgroud: AudioSource = null!;


    // 音效：点击
    public clipClick: AudioClip = null!;

    // 音效：扩展
    public clipExtand: AudioClip = null!;

    // 音效：铲除
    public clipWipe: AudioClip = null!;

    // 音效：收获
    public clipGather: AudioClip = null!;

    // 音效：烟花
    public clipFireworks: AudioClip = null!;


    protected onLoad(): void {
        common.audioController = this;

        // 加载背景音乐
        // resources.load('audio/bg', AudioClip, (err, audio) => {
        //     this.backgroud.clip = audio;
        //     this.backgroud.loop = true;
        //     this.playBGM();
        // })

        // 加载音效：点击
        resources.load('audio/click', AudioClip, (err, audio) => { if (err) { console.log("load audio error"); error(err.message || err); return; } this.clipClick = audio; })

        // 加载音效：扩展
        resources.load('audio/extand', AudioClip, (err, audio) => { if (err) { console.log("load audio error"); error(err.message || err); return; } this.clipExtand = audio; })

        // 加载音效：铲除
        resources.load('audio/wipe', AudioClip, (err, audio) => { if (err) { console.log("load audio error"); error(err.message || err); return; } this.clipWipe = audio; })
        
        // 加载音效：收获
        resources.load('audio/gather', AudioClip, (err, audio) => { if (err) { console.log("load audio error"); error(err.message || err); return; } this.clipGather = audio; })
        
        // 加载音效：烟花
        resources.load('audio/fireworks', AudioClip, (err, audio) => { if (err) { console.log("load audio error"); error(err.message || err); return; } this.clipFireworks = audio; })
    }

    // 播放音效, filename: 文件名，例如：click（相对于resources/audio的路径）
    playSound(filename) {
        resources.load("audio/" + filename, AudioClip, (err, audio) => {
            this.backgroud.playOneShot(audio);
        })
    }

    // 播放音乐
    playBGM() {
        this.backgroud.play();
    }

    // 暂停音乐
    pauseBGM() {
        this.backgroud.pause();
    }

    // 停止音乐
    stopBGM() {
        this.backgroud.stop();
    }

    // 音效：点击
    playSoundClick() {
        this.backgroud.playOneShot(this.clipClick, 1);
    }

    // 音效：扩建
    playSoundExtand() {
        this.backgroud.playOneShot(this.clipExtand, 1);
    }

    // 音效：铲除
    playSoundWipe() {
        this.backgroud.playOneShot(this.clipWipe, 1);
    }

    // 音效：收获
    playSoundGather() {
        this.backgroud.playOneShot(this.clipGather, 1);
    }

    // 音效：烟花
    playSoundFireworks() {
        this.backgroud.playOneShot(this.clipFireworks, 1);
    }
}