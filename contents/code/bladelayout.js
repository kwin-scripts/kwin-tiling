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

// FIXME: Crash on moving client to another desktop
/**
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function BladeLayout(screenRectangle) {
	try {
		print("Creating BladeLayout");
		Layout.call(this, screenRectangle);
		// TODO
	} catch(err) {
		print(err, "in BladeLayout");
	}
	this.master = 0;
}

BladeLayout.name = "Blade";
// TODO: Add an image for the layout switcher
BladeLayout.image = null;

BladeLayout.prototype = new Layout();
BladeLayout.prototype.constructor = BladeLayout;

BladeLayout.prototype.resetTileSizes = function() {
	try {
		// Simply erase all tiles and recreate them to recompute the initial sizes
		var tileCount = this.tiles.length;
		this.tiles.length = 0;
		for (var i = 0; i < tileCount; i++) {
			this.addTile();
		}
	} catch(err) {
		print(err, "in BladeLayout.resetTileSizes");
	}
}

BladeLayout.prototype.addTile = function() {
	try {
		if (this.tiles.length == 0) {
			// The first tile fills the whole screen
			var rect = util.copyRect(this.screenRectangle);
			this._createTile(rect);
			return;
		} else {
			// Divide the screen width evenly between full-height tiles
			// FIXME: Screenrectangle for struts is weird
			var lastRect = this.tiles[0].rectangle;
			var newRect = Qt.rect(this.screenRectangle.x,
								  lastRect.y,
								  (this.screenRectangle.width + this.screenRectangle.x) / (this.tiles.length + 1), 
								  this.screenRectangle.height);
			// FIXME: Try to keep ratio
			for (var i = 0; i < this.tiles.length; i++) { 
				var rect = this.tiles[i].rectangle;
				rect.x = newRect.x + newRect.width * i;
				rect.width = newRect.width;
				this.tiles[i].rectangle = rect;
			}
			// Adjust tile's width for rounding errors
			newRect.x = newRect.x + newRect.width * this.tiles.length;
			newRect.width = (this.screenRectangle.width + this.screenRectangle.x) - newRect.x;
			// TODO: Move this before setting ratio to simplify
			this._createTile(newRect);
		}
	} catch(err) {
		print(err, "in BladeLayout.addTile");
	}
}

BladeLayout.prototype.removeTile = function(tileIndex) {
	try {
		// Remove the array entry
		var oldrect = this.tiles[tileIndex].rectangle;
		this.tiles.splice(tileIndex, 1);
		// Update the other tiles
		if (this.tiles.length == 1) {
			this.tiles[0].rectangle = util.copyRect(this.screenRectangle);
			this.tiles[0].hasDirectNeighbour[Direction.Left] = false;
			this.tiles[0].hasDirectNeighbour[Direction.Right] = false;
		}
		if (this.tiles.length > 1) {
			var tileCount = this.tiles.length;
			var lastRect = this.tiles[0].rectangle;
			var newRect = Qt.rect(this.screenRectangle.x,
								  this.screenRectangle.y,
								  this.screenRectangle.width / tileCount,
								  this.screenRectangle.height);
			var lowest = 1;
			for (var i = 0; i < this.tiles.length; i++) {
				var rect = this.tiles[i].rectangle;
				rect.x = newRect.x + newRect.width * i;
				rect.width = newRect.width;
				this.tiles[i].rectangle = rect;
				this.tiles[i].hasDirectNeighbour[Direction.Left] = (i > 0);
				this.tiles[i].hasDirectNeighbour[Direction.Right] = (i < this.tiles.length - 1);
				this.tiles[i].neighbours[Direction.Left] = i - 1;
				this.tiles[i].neighbours[Direction.Right] = i + 1;
			}
			// Adjust rightmost tile's height for rounding errors
			this.tiles[this.tiles.length - 1].rectangle.width = (this.screenRectangle.width + this.screenRectangle.x) - this.tiles[this.tiles.length - 1].rectangle.x;
		}
	} catch(err) {
		print(err, "in BladeLayout.removeTile");
	}
}

BladeLayout.prototype.resizeTile = function(tileIndex, rectangle) {
	try {
		// TODO: Mark tile as resized so it can keep its size on tileadd/remove
		if (tileIndex < 0 || tileIndex > this.tiles.length) {
			print("Tileindex invalid", tileIndex, "/", this.tiles.length);
			return;
		}
		var tile = this.tiles[tileIndex];
		if (tile == null) {
			print("No tile");
			return;
		}
		if (rectangle == null){
			print("No rect");
			return;
		}
		// Cap rectangle at screenedges
		var oldRect = tile.rectangle;
		if (rectangle.x < this.screenRectangle.x) {
			// Width can only change in reaction to the x change
			// As we only resize width and height, we can return here
			if (tileIndex == 0) {
				return;
			}
			rectangle.x = this.screenRectangle.x;
		}
		// First tile should not move away from left edge
		if (oldRect.x == this.screenRectangle.x && rectangle.x != oldRect.x) {
			if (tileIndex == 0) {
				return;
			}
		}
		if (rectangle.y + rectangle.height > this.screenRectangle.y + this.screenRectangle.height) {
			rectangle.height = this.screenRectangle.y + this.screenRectangle.height - rectangle.y;
		}
		if (rectangle.x + rectangle.width > this.screenRectangle.x + this.screenRectangle.width) {
			rectangle.width = this.screenRectangle.x + this.screenRectangle.width - rectangle.x;
		}
		if (tileIndex == this.tiles.length - 1) {
			rectangle.width = (this.screenRectangle.x + this.screenRectangle.width) - rectangle.x;
		}
		rectangle.y = this.screenRectangle.y;
		rectangle.height = this.screenRectangle.height;
		var newRect = Qt.rect(this.screenRectangle.x,
							  this.screenRectangle.y,
							  (rectangle.x - this.screenRectangle.x) / tileIndex,
							  this.screenRectangle.height);
		for(i = 0; i < tileIndex; i++) {
			var rect = this.tiles[i].rectangle;
			rect.x = newRect.x + newRect.width * i;
			rect.width = newRect.width;
			this.tiles[i].rectangle = rect;
		}
		// Rightmost point - Right edge of resized window / number of tiles on the right side
		// Do rounding later to preserve accuracy
		newRect.width = ((this.screenRectangle.width + this.screenRectangle.x)
									- (rectangle.x + rectangle.width)) 
								   / (this.tiles.length - (tileIndex + 1));
		for(i = tileIndex + 1; i < this.tiles.length; i++){
			var rect = this.tiles[i].rectangle;
			rect.x = (rectangle.x + rectangle.width) + (i - tileIndex - 1) * newRect.width;
			rect.width = newRect.width;
			this.tiles[i].rectangle = rect;
		}
		rectangle.y = this.screenRectangle.y;
		rectangle.height = this.screenRectangle.height;
		this.tiles[tileIndex].rectangle = rectangle;
	} catch(err) {
		print(err, "in BladeLayout.resizeTile");
	}
}

BladeLayout.prototype._createTile = function(rect) {
	try {
		// Update the last tile in the list
		if (this.tiles.length > 0) {
			var lastTile = this.tiles[this.tiles.length - 1];
			lastTile.neighbours[Direction.Right] = this.tiles.length;
			lastTile.hasDirectNeighbour[Direction.Right] = true;
		}
		// Create a new tile and add it to the list
		var tile = {};
		tile.rectangle = rect;
		tile.neighbours = [];
		tile.hasDirectNeighbour = [];
		tile.neighbours[Direction.Left] = (this.tiles.length - 1);
		tile.hasDirectNeighbour[Direction.Left] = (this.tiles.length > 0);
		tile.neighbours[Direction.Right] = -1;
		tile.hasDirectNeighbour[Direction.Right] = false;
		tile.hasDirectNeighbour[Direction.Up] = false;
		tile.neighbours[Direction.Up] = -1;
		tile.neighbours[Direction.Down] = - 1;
		tile.hasDirectNeighbour[Direction.Down] = false;
		tile.index = this.tiles.length;
		this.tiles.push(tile);
	} catch(err) {
		print(err, "in BladeLayout._createTile");
	}
}
