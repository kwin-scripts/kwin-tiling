util = {};
util.copyRect = function(rect) {
	return Qt.rect(rect.x,
				   rect.y,
				   rect.width,
				   rect.height);
}

util.setRect = function(rect1,rect2) {
	rect1.x = rect2.x;
	rect1.y = rect2.y;
	rect1.width = rect2.width;
	rect1.height = rect2.height;
}

util.compareRect = function(rect1,rect2) {
	return rect1.x == rect2.x &&
		rect1.y == rect2.y    &&
		rect1.width == rect2.width &&
		rect1.height == rect2.height;
}
