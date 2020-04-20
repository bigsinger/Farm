/****************************************************************************
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.
 
 http://www.cocos2d-x.org
 
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 
 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.
 
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

#pragma once
#include <cocos2d.h>
#include <cocos/ui/UIButton.h>
#include "SoilLayer.h"

USING_NS_CC;


class MainScene : public cocos2d::Scene
{
public:
    virtual bool init() override;
	virtual void update(float dt) override;

    static cocos2d::Scene* scene();

    // a selector callback
    void menuCloseCallback(Ref* sender);

    // implement the "static create()" method manually
    CREATE_FUNC(MainScene);

private:
	void preloadResources();

	void initEffective();

	void initCloud();

	void initBird();

	void playBird();

	// TODO 这里面的字体什么的不熟悉使用的不对，也没兴趣研究了 有志之士可以弄下
	void updateShowingGold(int goldNum);
	void updateShowingLv(int lv);
	void updateShowingExp(int exp, int maxExp);

private:
	virtual bool onTouchBegan(Touch *touch, Event *unusedEvent);
	virtual bool onTouchMoved(Touch *touch, Event *unusedEvent);
	virtual bool onTouchEnded(Touch *touch, Event *unusedEvent);

private:
	Layer * layerFarm = nullptr;

	SoilLayer* m_pSoilLayer = nullptr;

	// 广告牌
	ui::Button* m_pBrandSprite = nullptr;

	// 房子仓库
	ui::Button* m_warehouse = nullptr;

	// 商店
	ui::Button* m_shop = nullptr;

	LabelAtlas*m_gold = nullptr;
	LabelAtlas*m_level = nullptr;
	LabelAtlas*m_exp = nullptr;
	ProgressTimer*m_expProgress = nullptr;

private:
	Sprite* m_pCloudAnimation = nullptr;

	ParticleSystemQuad *m_clickShowing = nullptr;

private:
	Vec2 touchBeginPoint = Vec2::ZERO;

};