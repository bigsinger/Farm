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

#include "MainScene.h"
#include "AppMacros.h"
#include <CCScheduler.h>
#include "cocostudio/CocoStudio.h"
#include <cocos/ui/UITextBMFont.h>
using namespace cocostudio;


USING_NS_CC;


Scene* MainScene::scene()
{
     return MainScene::create();
}

bool MainScene::onTouchBegan(Touch *touch, Event *unusedEvent) {
	//auto label = static_cast<LabelBMFont*>(this->getChildByTag(10));
	//label->setString(text);
	Point location = touch->getLocation();
	log("onTouchBegan: %0.2f, %0.2f", location.x, location.y);
	touchBeginPoint.x = location.x;
	touchBeginPoint.y = location.y;

	//是否点击了土地
	auto soil = m_pSoilLayer->getClickingSoil(location);
	return true;
}

bool MainScene::onTouchMoved(Touch *touch, Event *unusedEvent) {
	if (touchBeginPoint != Vec2::ZERO) {
		Vec2 location = touch->getLocation();
		Vec2 lastPos = layerFarm->getPosition();
		layerFarm->setPosition(lastPos.x + location.x - touchBeginPoint.x, lastPos.y + location.y - touchBeginPoint.y);
		touchBeginPoint.x = location.x;
		touchBeginPoint.y = location.y;
	}
	return true;
}

bool MainScene::onTouchEnded(Touch *touch, Event *unusedEvent) {
	Vec2 location = touch->getLocation();
	log("onTouchEnded: %0.2f, %0.2f", location.x, location.y);
	touchBeginPoint = Vec2::ZERO;

#if 0
	ParticleSystemQuad *m_clickShowing = ParticleSystemQuad::create("effect/showClick.plist");
	if (m_clickShowing) {
		m_clickShowing->setScale(0.5f);
		m_clickShowing->setPosition(location);
		m_clickShowing->setAutoRemoveOnFinish(true);	// 粒子播放后释放内存
		this->addChild(m_clickShowing);
	}
#endif

	return true;
}

// on "init" you need to initialize your instance
bool MainScene::init()
{
    //////////////////////////////
    // 1. super init first
    if ( !Scene::init() )
    {
        return false;
    }
    
    auto visibleSize = Director::getInstance()->getVisibleSize();
    auto origin = Director::getInstance()->getVisibleOrigin();

	const Size& winSize = Director::getInstance()->getWinSize();
	GLView* glview = Director::getInstance()->getOpenGLView();
	float scale = glview->getScaleX();

	preloadResources();

	// 背景，全屏显示
	layerFarm = Layer::create();
	this->addChild(layerFarm);

	Sprite* bg = Sprite::create("farm_map/farm_bg01.png");
	bg->setPosition(Vec2(winSize.width / 2, winSize.height / 2));
	float spx = bg->getTextureRect().getMaxX();
	float spy = bg->getTextureRect().getMaxY();
	bg->setScaleX(winSize.width / spx);
	bg->setScaleY(winSize.height / spy);
	layerFarm->addChild(bg);

	// 广告牌 Sprite::createWithSpriteFrameName("farm_ui_tag_bg.png");
	m_pBrandSprite = ui::Button::create("farm_ui_tag_bg.png", "", "", ui::Widget::TextureResType::PLIST);
	m_pBrandSprite->setPosition(Vec2(570, 600));
	layerFarm->addChild(m_pBrandSprite);

	m_warehouse = ui::Button::create("farm_ui_warehouse.png", "", "", ui::Widget::TextureResType::PLIST);
	m_warehouse->setPosition(Vec2(m_pBrandSprite->getPositionX() - 200, m_pBrandSprite->getPositionY() - 40));
	layerFarm->addChild(m_warehouse);
	m_warehouse->addClickEventListener([](Ref* ref) {
		log("click warehouse");
	});

	//从SpriteFrames创建UI按钮m_pBrandSprite
	m_shop = ui::Button::create("farm_ui_shop.png", "", "", ui::Widget::TextureResType::PLIST);
	m_shop->setPosition(Vec2(m_warehouse->getPositionX() - 100, m_warehouse->getPositionY()));
	layerFarm->addChild(m_shop);
	m_shop->addClickEventListener([](Ref* ref) {
		log("click shop");
	});

	// 土地
	m_pSoilLayer = SoilLayer::create();
	layerFarm->addChild(m_pSoilLayer);

	
	// 作物
	for (int i = 0; i < 3; i++) {
		for (int j = 0; j < 6; j++) {
			m_pSoilLayer->addSoil(i + 3 + j, 1);
			m_pSoilLayer->addCrop(i, j, StringUtils::format("crop_101_%02d.png", (i * 3 + j) % 4 + 1));
		}
	}

	// 添加事件监听器
	auto _touchListener = EventListenerTouchOneByOne::create();
	_touchListener->onTouchBegan = CC_CALLBACK_2(MainScene::onTouchBegan, this);
	_touchListener->onTouchMoved = CC_CALLBACK_2(MainScene::onTouchMoved, this);
	_touchListener->onTouchEnded = CC_CALLBACK_2(MainScene::onTouchEnded, this);
	//_touchListener->onTouchCancelled = CC_CALLBACK_2(Widget::onTouchCancelled, this);
	_eventDispatcher->addEventListenerWithSceneGraphPriority(_touchListener, this);


	initEffective();
	/////////////////////////////
    // 2. add a menu item with "X" image, which is clicked to quit the program
    //    you may modify it.

   // add a "close" icon to exit the progress. it's an autorelease object
   auto closeItem = MenuItemImage::create(
                                       "CloseNormal.png",
                                       "CloseSelected.png",
                                       CC_CALLBACK_1(MainScene::menuCloseCallback,this));

   closeItem->setPosition(origin + Vec2(visibleSize) - Vec2(closeItem->getContentSize() / 2));

   // create menu, it's an autorelease object
   auto menu = Menu::create(closeItem, nullptr);
   menu->setPosition(Vec2::ZERO);
   this->addChild(menu, 1);


	updateShowingGold(100);
	updateShowingLv(1);
	updateShowingExp(109, 1000);

	// 开始update函数
	this->scheduleUpdate();
    return true;
}

void MainScene::update(float dt) {
	m_pSoilLayer->update();
}

void MainScene::menuCloseCallback(Ref* sender)
{
    Director::getInstance()->end();
}

//加载资源
void MainScene::preloadResources() {
	auto spriteCache = SpriteFrameCache::getInstance();
	spriteCache->addSpriteFramesWithFile("sprite/farm_crop_res.plist");
	spriteCache->addSpriteFramesWithFile("sprite/farm_ui_res.plist");
	spriteCache->addSpriteFramesWithFile("sprite/good_layer_ui_res.plist");
	spriteCache->addSpriteFramesWithFile("sprite/slider_dialog_ui_res.plist");
	spriteCache->addSpriteFramesWithFile("sprite/crop.plist");
}

void MainScene::initEffective() {
	initCloud();
	//initBird(); // TODO：会崩溃，这块代码是直接从lua版本迁移过来的，怀疑是cocos2dx的版本不同导致的不兼容，有兴趣的研究吧
}

void MainScene::playBird() {
	this->unschedule(SEL_SCHEDULE(&MainScene::playBird));
}

void MainScene::initCloud() {
	int index = rand() % 3 + 1;
	m_pCloudAnimation = Sprite::create(StringUtils::format("cloud/cloud%d.png", index));
	m_pCloudAnimation->setOpacity(0);
	m_pCloudAnimation->setPosition(Vec2(m_shop->getPositionX(), m_shop->getPositionY()));
	layerFarm->addChild(m_pCloudAnimation);

	// ref: https://www.cnblogs.com/as3lib/p/3992946.html
	Sequence* seq = Sequence::create(
		DelayTime::create((float)(rand() % 5)),
		FadeIn::create(3),
		MoveTo::create(40, Vec2(layerFarm->getContentSize().width, m_pCloudAnimation->getPosition().y)),
		Place::create(Vec2(-m_pCloudAnimation->getContentSize().width, m_pCloudAnimation->getPosition().y)),
		FadeOut::create(3),
		nullptr);
	m_pCloudAnimation->runAction(RepeatForever::create(seq));

	//Action* action = Sequence::create(
	//	DelayTime::create(rand() % 5),
	//	CallFunc::create(func),
	//	FadeIn::create(3),
	//	DelayTime::create(28),
	//	FadeOut::create(3),
	//	CallFunc::create([]() {
	//	log("test"); }), nullptr
	//);
	//m_pCloudAnimation->runAction(action);
}


// 飞鸟
void MainScene::initBird() {
	// loadBirdAnimationFile
	//CCArmatureDataManager::getInstance()->addArmatureFileInfoAsync("bird/bird.ExportJson", this, schedule_selector(MainScene::dataLoaded));
	CCArmatureDataManager::getInstance()->addArmatureFileInfo("bird/bird.ExportJson");
	cocostudio::Armature *m_pBirdAnimation = NULL;
	m_pBirdAnimation = cocostudio::Armature::create("bird");
	m_pBirdAnimation->setPosition(Vec2(m_shop->getPositionX(), m_shop->getPositionY()));
	layerFarm->addChild(m_pBirdAnimation);

	float rotation = 15.0f;
	if (rand() % 2 == 0) {
		rotation = -15.0f;
	}

	auto funcBird = [&]() {
		static bool m_bStarAnimation = true;
		m_pBirdAnimation->getAnimation()->playWithIndex(0);
		//birdMove();
		m_pBirdAnimation->setRotation(rotation);
		m_pBirdAnimation->getAnimation()->setMovementEventCallFunc([=](Armature* arm, MovementEventType type, const std::string& id) {
			if (type == MovementEventType::COMPLETE) {
				//remove();
				m_bStarAnimation = false;
				scheduleOnce(SEL_SCHEDULE(&MainScene::playBird), 30);
			}
		});
	};

	Sequence* seq = Sequence::create(DelayTime::create((float)(rand() % 5)), CallFunc::create(funcBird), nullptr);
	m_pBirdAnimation->runAction(seq);
}

void MainScene::updateShowingGold(int goldNum) {
	static Label* labelGold = nullptr;
	if ( !labelGold) {
		//labelGold = ui::TextBMFont::create("金币：", "fonts/1.fnt");
		labelGold = Label::createWithSystemFont("金币：", "Arial", 20);
		labelGold->setAnchorPoint(Vec2(0, 0.5));
		labelGold->setPosition(Point(m_pBrandSprite->getPositionX()-70, m_pBrandSprite->getPositionY() + 40));
		layerFarm->addChild(labelGold);
	}
	if (!m_gold) {
		m_gold = LabelAtlas::create("100000", "fonts/common-font.png", 16, 24, 48);
		m_gold->setPosition(Point(m_pBrandSprite->getPositionX() + 105, m_pBrandSprite->getPositionY() + 20));
		layerFarm->addChild(m_gold);
	}

	if (m_gold) { m_gold->setString(StringUtils::toString(goldNum)); }
}

void MainScene::updateShowingLv(int lv) {
	if (!m_level) {
		m_level = LabelAtlas::create("100000", "fonts/common-font.png", 16, 24, 48);
		m_level->setPosition(Point(m_gold->getPositionX(), m_gold->getPositionY() - 30));
		layerFarm->addChild(m_level);
	}

	if (m_level) { m_level->setString(StringUtils::toString(lv)); }
}

void MainScene::updateShowingExp(int exp, int maxExp) {
	if (!m_exp) {
		m_exp = LabelAtlas::create("100000", "fonts/common-font.png", 16, 24, 48);
		m_exp->setPosition(Point(m_gold->getPositionX(), m_gold->getPositionY() - 60));
		layerFarm->addChild(m_exp);
	}

	if (m_exp) { m_exp->setString(StringUtils::toString(exp)); }

	if (!m_expProgress) {
		Sprite *spriteExp = Sprite::createWithSpriteFrameName("fm_s2.png");
		m_expProgress = ProgressTimer::create(spriteExp);
		m_expProgress->setType(ProgressTimer::Type::BAR);

		//从左到右  
		m_expProgress->setMidpoint(Vec2(0, 0.5));
		m_expProgress->setBarChangeRate(Vec2(1, 0));
		m_expProgress->setPercentage(30);
		m_expProgress->setPosition(Vec2(m_exp->getPositionX(), m_exp->getPositionY()));
		layerFarm->addChild(m_expProgress, 0, 0);
	}
}