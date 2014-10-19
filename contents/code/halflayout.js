/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2013 Fabian Homborg <FHomborg@gmail.com>
based on spirallayout.js by Matthias Gottschlag

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*********************************************************************/

/**
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function HalfLayout(screenRectangle) {
	print("Creating HalfLayout");
    Layout.call(this, screenRectangle);
	this.firstWidth = this.screenRectangle.width / 2;
	this.master = 0;
	this.masterCount = 1;
};

HalfLayout.name = "Half";
// TODO: Add an image for the layout switcher
HalfLayout.image = null;

HalfLayout.prototype = new Layout();
HalfLayout.prototype.constructor = HalfLayout;

HalfLayout.prototype.addTile = function() {
	try {
		if (this.tiles.length == 0) {
			// The first tile fills the whole screen
			var rect = util.copyRect(this.screenRectangle);
			// util.assertRectInScreen(rect, this.screenRectangle);
			this._createTile(rect);
			return;
		} 
		if (this.tiles.length <= this.masterCount) {
			// The second tile fills the right half of the screen
			if (this.tiles.length < this.masterCount) {
				var newWidth = this.screenRectangle.width / (this.tiles.length + 1);
				var newSWidth = newWidth;
			} else {
				var newWidth = this.firstWidth / (this.tiles.length);
				var newSWidth = this.screenRectangle.width - this.firstWidth;
			}
			for (var i = 0; i < this.tiles.length; i++) {
				this.tiles[i].rectangle.x = this.screenRectangle.x + i * newWidth;
				this.tiles[i].rectangle.width = newWidth;
			}

			var lastRect = this.tiles[this.tiles.length - 1].rectangle;
			var newRect = Qt.rect(lastRect.x + lastRect.width,
									  this.screenRectangle.y,
									  newSWidth,
									  this.screenRectangle.height);
			// util.assertRectInScreen(newRect, this.screenRectangle);
			this._createTile(newRect);
			return;
		}
		if (this.tiles.length > this.masterCount) {
			print("Adding slaves");
			// Every other tile separates the right half
			var slaveCount = this.tiles.length - this.masterCount;
			var lastRect = this.tiles[this.master + this.masterCount].rectangle;
			var newRect = Qt.rect(lastRect.x,
									  lastRect.y,
									  this.screenRectangle.x + this.screenRectangle.width - this.getMasterWidth(),
									  this.screenRectangle.height / (slaveCount + 1));
			newRect.y = newRect.y + newRect.height * slaveCount;
			// FIXME: Try to keep ratio
			for (var i = this.master + this.masterCount; i < this.tiles.length; i++) {
				var rect = this.tiles[i].rectangle;
				rect.x = newRect.x;
				var offset = newRect.height * (i - (this.master + this.masterCount));
				rect.y = lastRect.y + offset;
				rect.width = newRect.width;
				rect.height = newRect.height;
				this.tiles[i].rectangle = rect;
			}
			// Adjust new tile's height for rounding errors
			newRect.height = (this.screenRectangle.y + this.screenRectangle.height) - newRect.y;
			// util.assertRectInScreen(newRect, this.screenRectangle);
			this._createTile(newRect);
		}
	} catch(err) {
		print(err, "in HalfLayout.addTile");
	}
	print("Added tile");
};

// Save the first tile's width
HalfLayout.prototype.resizeTile = function(tileIndex, rectangle) {
	Layout.prototype.resizeTile.call(this, tileIndex, rectangle);
	this.firstWidth = this.getMasterWidth();
};

HalfLayout.prototype.getMasterWidth = function() {
	var tile = this.tiles[Math.min(this.tiles.length, this.masterCount) - 1];
	if (tile != null) {
		var lastMaster = tile.rectangle;
		return lastMaster.x + lastMaster.width - this.screenRectangle.x;
	} else {
		// No masters exist
		return 0;
	}
};

HalfLayout.prototype.removeTile = function(tileIndex) {
	try {
		//FIXME: There is a crash here
		// Remove the array entry
		var oldrect = this.tiles[tileIndex].rectangle;
		if (tileIndex < 0 || tileIndex >= this.tiles.length) {
			print("Removing invalid tileindex");
			return;
		}
		this.tiles.splice(tileIndex, 1);
		// Update the other tiles
		if (this.tiles.length == 1) {
			this.tiles[0].rectangle = util.copyRect(this.screenRectangle);
		}
		if (this.tiles.length > 1) {
			var mC = Math.min(this.tiles.length, this.masterCount);
			if (this.tiles.length > mC) {
				var mWidth = (this.screenRectangle.width - this.tiles[this.masterCount].rectangle.width) / mC;
			} else {
				var mWidth = this.screenRectangle.width / this.tiles.length;
			}
			for (var i = 0; i < mC; i++) {
				this.tiles[i].rectangle.x = i * mWidth + this.screenRectangle.x;
				this.tiles[i].rectangle.width = mWidth;
				this.tiles[i].rectangle.height = this.screenRectangle.height;
				this.tiles[i].rectangle.y = this.screenRectangle.y;
			}
			// Fallthrough for slaves
		}
		if (this.tiles.length > this.masterCount) {
			if (tileIndex == 0) {
				this.tiles[0].rectangle = oldrect;
			}
			var tileCount = this.tiles.length - this.masterCount;
			// assertTrue(tileCount > 0, "Tilecount is zero");
			var lastRect = this.tiles[0].rectangle;
			var newRect = Qt.rect(this.screenRectangle.x + this.getMasterWidth(),
									  this.screenRectangle.y,
									  this.screenRectangle.width - this.getMasterWidth(),
									  this.screenRectangle.height / tileCount);
			// assertTrue(newRect.height > 0, "newRect.height is zero");
			var lowest = this.tiles.length - 1;
			for (var i = this.masterCount + this.master; i < this.tiles.length; i++) {
				var rect = this.tiles[i].rectangle;
				rect.y = newRect.y + newRect.height * (i - this.masterCount);
				rect.height = newRect.height;
				this.tiles[i].rectangle = rect;
			}
			// Adjust lowest tile's height for rounding errors
			this.tiles[lowest].rectangle.height = (this.screenRectangle.y + this.screenRectangle.height) - this.tiles[lowest].rectangle.y;
			// assertTrue(this.tiles[lowest].rectangle.height > 0, "Lowest rect has zero height");
		}
	} catch(err) {
		print(err, "in HalfLayout.removeTile");
	}
};

HalfLayout.prototype.increaseMaster = function() {
	var oldC = this.masterCount;
	this.masterCount++;
	if (this.tiles.length == 0) {
		return;
	}
	if (this.masterCount > 1) {
		if (this.tiles.length >= this.master + oldC && oldC > 0) {
			var rightEdgeRect = this.tiles[this.master + oldC - 1].rectangle;
			var rightEdge = util.getR(rightEdgeRect);
		}
		if (this.masterCount < this.tiles.length) {
			var newWidth = (rightEdge) / (oldC + 1);
		} else if (this.masterCount == this.tiles.length) {
			var newWidth = (this.screenRectangle.width) / (this.masterCount);
		} else {
			return;
		}
		for (var i = this.master; i < Math.min(this.master + oldC,this.tiles.length); i++) {
			this.tiles[i].rectangle.x = this.screenRectangle.x + newWidth * (i - this.master);
			this.tiles[i].rectangle.y = this.screenRectangle.y;
			this.tiles[i].rectangle.width = newWidth;
			this.tiles[i].rectangle.height = this.screenRectangle.height;
		}
		this.tiles[this.master + this.masterCount - 1].rectangle = Qt.rect(rightEdgeRect.x + rightEdgeRect.width,
																			   rightEdgeRect.y,
																			   newWidth,
																			   rightEdgeRect.height);
	} else {
		this.tiles[this.master + this.masterCount - 1].rectangle = Qt.rect(this.screenRectangle.x,
																			   this.screenRectangle.y,
																			   this.firstWidth,
																			   this.screenRectangle.height);
	}
	var newHeight = (this.screenRectangle.y + this.screenRectangle.height) / (this.tiles.length - (this.master + this.masterCount));
	for (var i = this.master + this.masterCount; i < this.tiles.length; i++) {
		this.tiles[i].rectangle.x = this.getMasterWidth();
		this.tiles[i].rectangle.width = this.screenRectangle.width - this.getMasterWidth();
		this.tiles[i].rectangle.height = newHeight;
		this.tiles[i].rectangle.y = this.screenRectangle.y + (i - (this.master + this.masterCount)) * newHeight;
	}
	this.firstWidth = this.getMasterWidth();
};

HalfLayout.prototype.decrementMaster = function() {
	var oldC = this.masterCount;
	var newC = this.masterCount - 1;
	if (this.masterCount == 0) {
		return;
	}
	// Explicitly allow usage without master - it's effectively a different layout
	if (this.masterCount == 1) {
		var oldMWidth = 0;
	} else {
		var oldMWidth = this.getMasterWidth();
	}
	if (this.tiles.length >= oldC) {
		var newMWidth = oldMWidth / newC;
		var newSWidth = this.screenRectangle.width - oldMWidth;
		var newSHeight = this.screenRectangle.height / (this.tiles.length - newC);
	} else {
		var newMWidth = this.screenRectangle.width / this.tiles.length;
	}
	for (var i = 0; i < Math.min(this.tiles.length,newC); i++) {
		this.tiles[i].rectangle.x = this.screenRectangle.x + i * newMWidth;
		this.tiles[i].rectangle.width = newMWidth;
		this.tiles[i].rectangle.y = this.screenRectangle.y;
		this.tiles[i].rectangle.height = this.screenRectangle.height;
		// util.assertRectInScreen(this.tiles[i].rectangle, this.screenRectangle);
	}
	for (var i = newC; i < this.tiles.length; i++) {
		this.tiles[i].rectangle.y = this.screenRectangle.y + (i - newC) * newSHeight;
		this.tiles[i].rectangle.height = newSHeight;
		this.tiles[i].rectangle.width = newSWidth;
		this.tiles[i].rectangle.x = this.screenRectangle.x + oldMWidth;
		// util.assertRectInScreen(this.tiles[i].rectangle, this.screenRectangle);
	}
	this.masterCount--;
	this.firstWidth = this.getMasterWidth();
};

Qt.include("util.js");
var Direction = {
    Up : 0,
    Down : 1,
    Left : 2,
    Right : 3
};

HalfLayout.prototype.setLayoutArea = function(newArea) {
	try {
		var oldArea = this.screenRectangle;
		var xscale = newArea.width / oldArea.width;
		var yscale = newArea.height / oldArea.height;
		var xoffset = newArea.x - oldArea.x;
		var yoffset = newArea.y - oldArea.y;
		this.tiles.forEach(function(tile) {
			var lastrect = tile.rectangle;
			var newrect = Qt.rect(Math.floor((lastrect.x + xoffset) * xscale),
								  Math.floor((lastrect.y + yoffset) * yscale),
								  Math.floor(lastrect.width * xscale),
								  Math.floor(lastrect.height * yscale));
			// Stay at the screenedges
			// It's better to have roundingerrors in the middle than at the edges
			// left screenedge, keep right windowedge (i.e. adjust width)
			if (lastrect.x == oldArea.x) {
				newrect.width = newrect.width + (newrect.x - newArea.x);
				newrect.x = newArea.x;
			}
			// Top screenedge, keep bottom windowedge (i.e. adjust height)
			if (lastrect.y == oldArea.y) {
				newrect.height = newrect.height + (newrect.y - newArea.y);
				newrect.y = newArea.y;
			}
			// Right screenedge, keep left windowedge (i.e. don't adjust x)
			if (lastrect.x + lastrect.width == oldArea.x + oldArea.width) {
				newrect.width = (newArea.width + newArea.x) - newrect.x;
			}
			// Bottom screenedge, keep top windowedge (i.e. don't adjust y)
			if (lastrect.y + lastrect.height == oldArea.y + oldArea.height) {
				newrect.height = (newArea.height + newArea.y) - newrect.y;
			}
			tile.rectangle = newrect;
		});
		this.screenRectangle = newArea;
	} catch(err) {
		print(err, "in Layout.setLayoutArea");
	}
};

HalfLayout.prototype.resizeTile = function(tileIndex, rectangle) {
	try {
		// Sanitize
		if (tileIndex < 0 || tileIndex > (this.tiles.length - 1)) {
			print("Tileindex invalid", tileIndex, "/", this.tiles.length);
			return;
		}
		if (this.tiles[tileIndex] == null) {
			print("No tile");
			return;
		}
		if (rectangle == null){
			print("No rect");
			return;
		}
		// Cut off parts outside of the screen
		var rect = util.intersectRect(rectangle, this.screenRectangle);
		if (rect == null) {
			print("Rectangle is off screen", util.rectToString(rectangle));
			return;
		}
		// TODO: Remove overlap
		this.doResize(tileIndex, rect, util.setX, util.getX, util.setR, util.getR);
		this.doResize(tileIndex, rect, util.setY, util.getY, util.setB, util.getB);
		this.doResize(tileIndex, rect, util.setR, util.getR, util.setX, util.getX);
		this.doResize(tileIndex, rect, util.setB, util.getB, util.setY, util.getY);
		this.tiles[tileIndex].rectangle = util.copyRect(rect);
	} catch(err) {
		print(err, "in Layout.resizeTile");
	}
};

/*
 * Resize all rectangles for one edge
 * Params:
 * set, get: a set/get function for one edge
 * setOther, getOther: a set/get function for the opposite edge
 */
HalfLayout.prototype.doResize = function(tileIndex, rectangle, set, get, setOther, getOther) {
	var oldD = get(this.tiles[tileIndex].rectangle);
	var newD = get(rectangle);
	if (oldD == newD) {
		return;
	}
	// Disallow moving away from screenedges
	if (oldD == get(this.screenRectangle)) {
		set(rectangle, oldD);
		return;
	}
	// Disallow moving to screenedges
	// - otherwise we need to check when moving away if this is supposed to be there
	if (newD == get(this.screenRectangle)) {
		set(rectangle, oldD);
		return;
	}
	/*
	 * A tile needs to be changed if it
	 * a) Had the same value as the oldRect
	 * b) Had the same other edge value as oldRect
	 */
	for (var i = 0; i < this.tiles.length; i++) {
		if (i == tileIndex) {
			continue;
		}
		var dOther = getOther(this.tiles[i].rectangle);
		var d = get(this.tiles[i].rectangle);
		if (d == oldD) {
			set(this.tiles[i].rectangle, newD);
			continue;
		}
		if (dOther == oldD) {
			setOther(this.tiles[i].rectangle, newD);
			continue;
		}
	}
};

HalfLayout.prototype.resetTileSizes = function() {
	try {
		// Simply erase all tiles and recreate them to recompute the initial sizes
		var tileCount = this.tiles.length;
		this.tiles.length = 0;
		for (var i = 0; i < tileCount; i++) {
			this.addTile();
		}
	} catch(err) {
		print(err, "in Layout.resetTileSizes");
	}
};

HalfLayout.prototype._createTile = function(rect) {
	try {
		// Create a new tile and add it to the list
		var tile = {};
		tile.rectangle = rect;
		tile.index = this.tiles.length;
		this.tiles.push(tile);
	} catch(err) {
		print(err, "in Layout._createTile");
	}
};

/**
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function HalfLayout(screenRectangle) {
	print("Creating HalfLayout");
	try {
		/**
		 * Screen area which is used by the layout.
		 */
		this.screenRectangle = screenRectangle;
		/**
		 * Geometry of the different tiles. This array stays empty in the case of
		 * floating layouts.
		 */
		this.tiles = [];
		// TODO
		print("Created layout");
	} catch(err) {
		print(err, "in Layout");
	}
	this.firstWidth = this.screenRectangle.width / 2;
	this.master = 0;
	this.masterCount = 1;
};

HalfLayout.name = "Half";
// TODO: Add an image for the layout switcher
HalfLayout.image = null;

HalfLayout.prototype = new Layout();
HalfLayout.prototype.constructor = HalfLayout;
