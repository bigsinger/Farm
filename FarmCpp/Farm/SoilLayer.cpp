#include "SoilLayer.h"
#include <cocos/2d/CCSprite.h>
#include <cocos/2d/CCTMXLayer.h>


// tile坐标 转成 瓦片格子中心的OpenGL坐标
Vec2 positionForTileCoord(TMXTiledMap*tiledMap, Vec2 position) {
	auto mapSize = tiledMap->getMapSize();
	auto tileSize = tiledMap->getTileSize();
	auto tileWidth = tiledMap->getBoundingBox().size.width / tiledMap->getMapSize().width;
	auto tileHeight = tiledMap->getBoundingBox().size.height / tiledMap->getMapSize().height;

	auto variable1 = (position.x + mapSize.width / 2 - mapSize.height) * tileWidth * tileHeight;
	auto variable2 = (-position.y + mapSize.width / 2 + mapSize.height) * tileWidth * tileHeight;

	float posx = (variable1 + variable2) / 2 / tileHeight;
	float posy = (variable2 - variable1) / 2 / tileWidth;

	return Point(posx, posy);
}


SoilLayer::SoilLayer() {
}

SoilLayer::~SoilLayer() {
}


bool SoilLayer::init() {
	m_pTiledMap = TMXTiledMap::create("farm_map/farm.tmx");
	//m_pTiledMap->setPosition(50, 150);
	m_pTiledMap->setAnchorPoint(Vec2::ZERO);
	m_pTiledMap->setPosition(Vec2(380, -135));
	this->addChild(m_pTiledMap);

	return true;
}

void SoilLayer::update() {

}


SoilPtr SoilLayer::getClickingSoil(const Vec2& loc) {
	SoilPtr soil = nullptr;
	auto it = std::find_if(m_soils.begin(), m_soils.end(), [&loc](SoilPtr soil) {
		//菱形对角线大小
		auto size = soil->getContentSize();
		auto soilPos = soil->getPosition();
		//进行坐标的变换
		auto pos = loc - soilPos;
		//计算矩形的大小的一半
		auto halfOfArea = size.width * size.height / 4;
		//计算点击点的面积大小
		auto clickOfArea = fabs(pos.x * size.height * 0.5f) + fabs(pos.y * size.width * 0.5f);
		//判断是否在菱形内
		return clickOfArea <= halfOfArea;

	});

	if (it != m_soils.end())
		soil = *it;

	return soil;
}


Sprite* SoilLayer::updateSoil(int soilID, int soilLv) {
	//读取土壤层所有土壤
	auto layer = m_pTiledMap->getLayer("soil layer");

	//找到对应的土壤精灵
	auto mapSize = m_pTiledMap->getMapSize();
	int width = (int)mapSize.width;

	int x = soilID % width;
	int y = soilID / width;

	auto tileCoordinate = Vec2((float)x, (float)y);
	//根据等级设置贴图
	int gid = 1 + soilLv;
	layer->setTileGID(gid, tileCoordinate);

	return layer->getTileAt(tileCoordinate);
}

SoilPtr SoilLayer::addSoil(int soilID, int soilLv) {
	//更新并获得土壤精灵
	auto sprite = this->updateSoil(soilID, soilLv);
	SoilPtr soil = Soil::create(sprite, soilID, soilLv);

	m_soils.push_back(soil);
	this->addChild(soil);
	//设置位置 当前位置已经是世界坐标
	auto pos = m_pTiledMap->convertToWorldSpace(sprite->getPosition());

	soil->setPosition(pos);

	return soil;
}

void SoilLayer::addCrop(int row, int col, const std::string&strCropName) {
	auto pos = positionForTileCoord(m_pTiledMap, Vec2((float)row, (float)col));
	pos = pos + Vec2(370, -155);
	ui::Button* spriteCrop = ui::Button::create(strCropName, "", "", ui::Widget::TextureResType::PLIST);
	spriteCrop->setName(strCropName);
	spriteCrop->setPosition(pos);
	spriteCrop->addClickEventListener([](Ref* ref) {
		ui::Button*self = (ui::Button*)ref;
		log("click %s", self->getName().c_str());
	});
	this->addChild(spriteCrop);
}