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

// FIXME: Neighbour stuff is bogus (just copied from spirallayout)
// FIXME: Crash on moving client to another desktop
/**
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function HalfLayout(screenRectangle) {
	print("Creating HalfLayout");
    Layout.call(this, screenRectangle);
    // TODO
}

HalfLayout.name = "Half";
// TODO: Add an image for the layout switcher
HalfLayout.image = null;

HalfLayout.prototype = new Layout();
HalfLayout.prototype.constructor = HalfLayout;

HalfLayout.prototype.onLayoutAreaChange = function(oldArea, newArea) {
	print("Scaling all tiles");
	this.tiles.forEach(function(tile) {
		var scale = newArea / oldArea;
		var lastrect = tile.rectangle;
		var newrect = Qt.rect(lastrect.x * scale,
							  lastrect.y * scale,
							  lastrect.width * scale,
							  lastrect.height * scale);
		tile.rectangle = newrect;
	});
}

HalfLayout.prototype.resetTileSizes = function() {
    // Simply erase all tiles and recreate them to recompute the initial sizes
    var tileCount = this.tiles.length;
    this.tiles.length = 0;
    for (var i = 0; i < tileCount; i++) {
        this.addTile();
    }
}

HalfLayout.prototype.addTile = function() {
    if (this.tiles.length == 0) {
        // The first tile fills the whole screen
        var rect = Qt.rect(this.screenRectangle.x,
                           this.screenRectangle.y,
                           this.screenRectangle.width,
                           this.screenRectangle.height);
        this._createTile(rect);
		return;
    } 
	if (this.tiles.length == 1) {
		// The second tile fills the right half of the screen
		// Also, javascript sucks
		var firstRect = Qt.rect(this.tiles[0].rectangle.x,
								this.tiles[0].rectangle.y,
								this.tiles[0].rectangle.width,
								this.tiles[0].rectangle.height);
		firstRect.width = Math.floor(this.screenRectangle.width / 2);
		this.tiles[0].rectangle = firstRect;
		var newRect = Qt.rect(firstRect.x + firstRect.width,
							  firstRect.y,
							  firstRect.width,
							  firstRect.height)
        this._createTile(newRect);
		return;
	}
	if (this.tiles.length > 1) {
		// Every other tile separates the right half
        var lastRect = this.tiles[0].rectangle;
        var newRect = Qt.rect(lastRect.x + lastRect.width,
                              lastRect.y,
                              this.screenRectangle.width - (lastRect.x + lastRect.width),
                              Math.floor(lastRect.height / (this.tiles.length)));
		newRect.y = newRect.y + newRect.height * (this.tiles.length - 1);
		// FIXME: Try to keep ratio
		for (i = 1; i < this.tiles.length; i++) {
			var rect = this.tiles[i].rectangle;
			rect.x = newRect.x;
			var offset = newRect.height * (i - 1);
			rect.y = lastRect.y + offset;
			rect.width = newRect.width;
			rect.height = newRect.height;
			this.tiles[i].rectangle = rect;
		}
		// Adjust lowest tile's height for rounding errors
		newRect.height = this.screenRectangle.height - newRect.y;
        this._createTile(newRect);
    }
}

HalfLayout.prototype.removeTile = function(tileIndex) {
	//FIXME: There is a crash here
    // Remove the array entry
	var oldrect = this.tiles[tileIndex].rectangle;
	this.tiles.splice(tileIndex, 1);
    // Update the other tiles
	if (this.tiles.length == 1) {
		this.tiles[0].rectangle = this.screenRectangle;
	}
    if (this.tiles.length > 1) {
        var tileCount = this.tiles.length - 1;
        var lastRect = this.tiles[0].rectangle;
        var newRect = Qt.rect(lastRect.width,
                              lastRect.y,
                              lastRect.width,
                              Math.floor(lastRect.height / tileCount));
		var lowest = 1;
		if (tileIndex == 0) {
			this.tiles[0].rectangle = oldrect;
		}
		for (i = 1; i < this.tiles.length; i++) {
			var rect = this.tiles[i].rectangle;
			rect.y = newRect.y + newRect.height * (i - 1);
			rect.height = newRect.height;
			this.tiles[i].rectangle = rect;
			if (this.tiles[lowest].rectangle.y < this.tiles[i].rectangle.y) {
				lowest = i;
			}
		}
		// Adjust lowest tile's height for rounding errors
		this.tiles[lowest].rectangle.height = this.screenRectangle.height - this.tiles[lowest].rectangle.y;
    }
    // Fix the neighbour information
    if (this.tiles.length > 0) {
        this.tiles[0].neighbours[Direction.Up] = this.tiles.length - 1;
        var lastTile = this.tiles[this.tiles.length - 1];
        lastTile.neighbours[Direction.Down] = 0;
        lastTile.hasDirectNeighbour[Direction.Down] = false;
    }
}

HalfLayout.prototype.resizeTile = function(tileIndex, rectangle) {
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
	if (rectangle.x < this.screenRectangle.x) {
		rectangle.x = this.screenRectangle.x;
	}
	if (rectangle.y < this.screenRectangle.y) {
		rectangle.y = this.screenRectangle.y;
	}
	if (rectangle.y + rectangle.height > this.screenRectangle.y + this.screenRectangle.height) {
		rectangle.height = this.screenRectangle.y + this.screenRectangle.height - rectangle.y;
	}
	if (rectangle.x + rectangle.width > this.screenRectangle.x + this.screenRectangle.width) {
		rectangle.width = this.screenRectangle.x + this.screenRectangle.width - rectangle.x;
	}
	if (tileIndex == 0) {
		// Simply adjust width on everything else, no height adjustment
		rectangle.x = tile.rectangle.x;
		rectangle.y = tile.rectangle.y;
		rectangle.height = tile.rectangle.height;
		tile.rectangle = rectangle;
		for (i = 1; i < this.tiles.length; i++) {
			this.tiles[i].rectangle.width = this.screenRectangle.width - rectangle.width;
			this.tiles[i].rectangle.x = this.screenRectangle.x + rectangle.width;
		}
	} else {
		this.tiles[0].rectangle.width = this.screenRectangle.width - rectangle.width;
		var belows = new Array();
		var aboves = new Array();
		for (i = 1; i < this.tiles.length; i++) {
			if (this.tiles[i].rectangle.y < tile.rectangle.y){
				aboves.push(i);
			}
			if (this.tiles[i].rectangle.y > tile.rectangle.y){
				belows.push(i);
			}
		}
		// Dividing by zero sucks
		if (aboves.length == 0) {
			var newHeightAbove = 0;
		} else {
			var newHeightAbove = Math.floor((rectangle.y - this.screenRectangle.y) / aboves.length);
		}
		if (belows.length == 0) {
			var newHeightBelow = 0;
		} else {
			var newHeightBelow = Math.floor((this.screenRectangle.height - rectangle.height) / belows.length);
		}
		if (belows.length > 0) {
			for (i = 0; i < belows.length; i++) {
				this.tiles[belows[i]].rectangle.width = rectangle.width;
				this.tiles[belows[i]].rectangle.x = rectangle.x;
				this.tiles[belows[i]].rectangle.y = rectangle.y + rectangle.height + newHeightBelow * i;
				this.tiles[belows[i]].rectangle.height = newHeightBelow;
			}
		}
		if (aboves.length > 0) {
			for (i = 0; i < aboves.length; i++) {
				this.tiles[aboves[i]].rectangle.width = rectangle.width;
				this.tiles[aboves[i]].rectangle.x = rectangle.x;
				this.tiles[aboves[i]].rectangle.y = newHeightAbove * i;
				this.tiles[aboves[i]].rectangle.height = newHeightAbove;
			}
		}
		tile.rectangle = rectangle;
		// No reason to set height when we have the full screen
		if (this.tiles.length == 2) {
			tile.rectangle.height = this.screenRectangle.height;
			tile.rectangle.y = this.screenRectangle.y;
		}
	}
}

HalfLayout.prototype._createTile = function(rect) {
    // Update the last tile in the list
    if (this.tiles.length != 0) {
        var lastTile = this.tiles[this.tiles.length - 1];
        lastTile.neighbours[Direction.Down] = this.tiles.length;
        lastTile.hasDirectNeighbour[Direction.Down] = true;
    }
    // Create a new tile and add it to the list
    var tile = {};
    tile.rectangle = rect;
    tile.neighbours = [];
    tile.hasDirectNeighbour = [];
    tile.neighbours[Direction.Left] = this.tiles.length;
    tile.hasDirectNeighbour[Direction.Left] = false;
    tile.neighbours[Direction.Right] = this.tiles.length;
    tile.hasDirectNeighbour[Direction.Right] = false;
    tile.neighbours[Direction.Up] = this.tiles.length - 1;
    tile.hasDirectNeighbour[Direction.Up] = true;
    tile.neighbours[Direction.Down] = 0;
    tile.hasDirectNeighbour[Direction.Down] = false;
	tile.index = this.tiles.length;
    this.tiles.push(tile);
    // Update the first tile
    this.tiles[0].neighbours[Direction.Up] = this.tiles.length - 1;
    this.tiles[0].hasDirectNeighbour[Direction.Up] = false;
}
