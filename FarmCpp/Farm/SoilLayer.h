#pragma once
#include <list>
#include "Soil.h"
#include <cocos/2d/CCLayer.h>
#include <cocos/ui/UIButton.h>
#include <cocos/2d/CCTMXTiledMap.h>
USING_NS_CC;

class SoilLayer :public Layer {
public:
	SoilLayer();
	~SoilLayer();

	SoilPtr getClickingSoil(const Vec2& pos);

	CREATE_FUNC(SoilLayer);
	virtual bool init() override;
	void update();

	SoilPtr addSoil(int soilID, int soilLv);
	void addCrop(int row, int col, const std::string&strCropName);

	Sprite* updateSoil(int soilID, int soilLv);
private:
	//µØÍ¼
	TMXTiledMap* m_pTiledMap = nullptr;

	std::list<SoilPtr>m_soils;
};

