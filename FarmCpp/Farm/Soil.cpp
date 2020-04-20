#include "Soil.h"

Soil* Soil::create(Sprite* sprite, int id, int level) {
	auto soil = new Soil();

	if (soil && soil->init(sprite, id, level))
		soil->autorelease();
	else {
		delete soil;
		soil = nullptr;
	}

	return soil;
}


bool Soil::init(Sprite* sprite, int id, int level) {
	m_pSprite = sprite;
	m_id = id;
	m_level = level;

	this->setContentSize(m_pSprite->getContentSize());
	this->setAnchorPoint(Point(0.5f, 0.5f));

	return true;
}