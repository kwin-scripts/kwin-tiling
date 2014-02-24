var util = {};
util.copyRect = function(rect) {
	return Qt.rect(rect.x,
				   rect.y,
				   rect.width,
				   rect.height);
}

// Sets rect1 to rect2 by value
util.setRect = function(rect1,rect2) {
	rect1.x = rect2.x;
	rect1.y = rect2.y;
	rect1.width = rect2.width;
	rect1.height = rect2.height;
}

// Returns true if rects are equal, false if not
util.compareRect = function(rect1,rect2) {
	if (rect1 == null || rect2 == null) {
		return rect1 == rect2;
	}
	return rect1.x == rect2.x &&
		rect1.y == rect2.y    &&
		rect1.width == rect2.width &&
		rect1.height == rect2.height;
}

util.intersectRect = function(rect1, rect2) {
	if (rect1.x + rect1. width < rect2.x ||
		rect2.x + rect2.width  < rect1.x ||
		rect1.y + rect1.height < rect2.y ||
		rect2.y + rect2.height < rect1.y) {
		return null; // No intersection
	}
	var newRect = Qt.rect(0,0,0,0);
	newRect.x = Math.max(rect1.x, rect2.x);
	newRect.y = Math.max(rect1.y, rect2.y);
	newRect.width = (Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - newRect.x);
	newRect.height = (Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - newRect.y);
	return newRect;
}

Math.floor = function(a) {
	return a;
}
