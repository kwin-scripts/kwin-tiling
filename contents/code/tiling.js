/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012 Mathias Gottschlag <mgottschlag@gmail.com>

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
 * Class which implements tiling for a single screen.
 * @class
 */
function Tiling(layoutType, desktop, screen) {
	try {
		this.desktop = desktop;
		this.screen  = screen;
		this.screenRectangle = Tiling.getTilingArea(this.screen, this.desktop);
		/**
		 * Tiles which have been added to the layout
		 */
		this.tiles = [];
		/**
		 * Layout type which provided the current layout.
		 */
		this.layoutType = layoutType;
		/**
		 * Layout which specifies window sizes/positions.
		 */
		this.layout = new layoutType(this.screenRectangle);
		/**
		 * active: True if the layout is active (i.e. on the current desktop)
		 * useractive: True if the layout is activated by the user
		 *             False if the user deactivated it
		 * useractive implies active
		 */
		this.active = false;
		this.userActive = true;
	} catch(err) {
		print(err, "in Tiling");
	}
}

/**
 * Utility function which returns the area on the selected screen/desktop which
 * is filled by the layout for that screen.
 *
 * @param desktop Desktop for which the area shall be returned.
 * @param screen Screen for which the area shall be returned.
 * @return Rectangle which contains the area which shall be used by layouts.
 */
Tiling.getTilingArea = function(screen, desktop) {
	var cA = workspace.clientArea(KWin.PlacementArea, screen, desktop);
	return Qt.rect(cA.x, cA.y, cA.width, cA.height);
};

Tiling.prototype.setLayoutType = function(layoutType) {
	try {
		var newLayout = new layoutType(this.layout.screenRectangle);
		for(i = 0; i < this.layout.tiles.length; i++) {
			newLayout.addTile();
			this.layout.tiles[i].tileIndex = i;
		}
		this.layout = newLayout;
		this.layoutType = layoutType;
		this.layout.resetTileSizes();
		this._updateAllTiles();
	} catch(err) {
		print(err, "in Tiling.setLayoutType");
	}
}

Tiling.prototype.addTile = function(tile, x, y) {
	try {
		this.layout.addTile();
		// If a position was specified, we insert the tile at the specified position
		if (x != null && y != null) {
			var index = this._getTileIndex(x, y);
			if (index == -1) {
				this.tiles.push(tile);
			} else {
				this.tiles.splice(index, 0, tile);
			}
		} else {
			if (tile.tileIndex > -1) {
				this.tiles.splice(tile.tileIndex, 0, tile);
			} else {
				if (readConfig("startAsMaster", false) == true) {
					tile.tileIndex = 0;
					this.tiles.splice(tile.tileIndex, 0, tile);
				} else {
					tile.tileIndex = this.tiles.length;
					this.tiles.push(tile);
				}
			}
			for (var i = 0; i < this.tiles.length; i++) {
				this.tiles[i].tileIndex = i;
				this.tiles[i].syncCustomProperties();
			}
		}
		this._updateAllTiles();
	} catch(err) {
		print(err, "in Tiling.addTile");
	}
}

Tiling.prototype.removeTile = function(tile) {
	try {
		var tileIndex = this.tiles.indexOf(tile);
		if (tileIndex > -1) {
			this.tiles.splice(tileIndex, 1);
			this.layout.removeTile(tileIndex);
			// Correct tileIndex
			for(i = 0; i < this.tiles.length; i++) {
				this.tiles[i].tileIndex = i;
				this.tiles[i].syncCustomProperties();
			}
			// TODO: Unregister tile callbacks
			this._updateAllTiles();
		}
	} catch(err) {
		print(err, "in Tiling.removeTile");
	}
}

Tiling.prototype.swapTiles = function(tile1, tile2) {
	try {
		// Cut down on updates by not doing them if tile1 is hovering over itself
		if (tile1 != tile2) {
			var index1 = this.tiles.indexOf(tile1);
			var index2 = this.tiles.indexOf(tile2);
			this.tiles[index1] = tile2;
			this.tiles[index2] = tile1;
			this.tiles[index1].tileIndex = index1;
			this.tiles[index2].tileIndex = index2;
			this.tiles[index1].syncCustomProperties();
			this.tiles[index2].syncCustomProperties();
			this._updateAllTiles();
			// This will only be called if tile1 just stopped moving
		} else if (tile1._moving == false) {
			this._updateAllTiles();
		}
	} catch(err) {
		print(err, "in Tiling.swapTiles");
	}
}

Tiling.prototype.activate = function() {
	if (this.userActive == true) {
		this.active = true;
		// Resize the tiles like specified by the layout
		this._updateAllTiles();
	}
}

Tiling.prototype.deactivate = function() {
    this.active = false;
}

Tiling.prototype.toggleActive = function() {
	if (this.active) {
		this.deactivate();
	} else {
		this.activate();
	}
}

Tiling.prototype.toggleUserActive = function() {
	if (this.userActive == true) {
		this.userActive = false;
		this.deactivate();
	} else {
		this.userActive = true;
		this.activate();
	}
}

/**
 * Resets tile sizes to their initial size (in case they were resized by the
 * user).
 */
Tiling.prototype.resetTileSizes = function() {
    this.layout.resetTileSizes();
    this._updateAllTiles();
}

Tiling.prototype.getTile = function(x, y) {
	try {
		var index = this._getTileIndex(x, y);
		if (index != -1) {
			return this.tiles[index];
		} else {
			return null;
		}
	} catch(err) {
		print(err, "in Tiling.getTile");
	}
}

Tiling.prototype._getTileIndex = function(x, y) {
	try {
		for (var i = 0; i < this.layout.tiles.length; i++) {
			var tile = this.layout.tiles[i];
			if (tile.rectangle.x <= x
                && tile.rectangle.y <= y
                && tile.rectangle.x + tile.rectangle.width > x
                && tile.rectangle.y + tile.rectangle.height > y) {
				return i;
			}
		}
		return -1;
	} catch(err) {
		print(err, "in Tiling._getTileIndex");
	}
}

Tiling.prototype.getAdjacentTile = function(from, direction, directOnly) {
	// If there is no tile, we can't select a thing
	if (this.layout.tiles.length == 0) {
		return;
	}
	// If no window is selected, just use the first
	if (from != null) {
		var index = this.tiles.indexOf(from);
	} else {
		return this.tiles[0];
	}
    var geometry = this.layout.tiles[index];
    var nextIndex = geometry.neighbours[direction];
    if (!geometry.hasDirectNeighbour && !directOnly) {
        // This is not a direct neighbour (wrap-around situation), so cycle
        // through the floating windows first
        // TODO
        print("TODO: getAdjacentTile(): Not a direct neighbour!");
    } else {
        return this.tiles[nextIndex];
    }
}

Tiling.prototype.resizeTile = function(tile){
	try {
		if (tile != null) {
			var tileIndex = tile.tileIndex;
			var client = tile.clients[0];
			this.layout.resizeTile(tileIndex, client.geometry);
			this._updateAllTiles();
		}
	} catch(err) {
		print(err, "in Tiling.resizeTile");
	}
}

Tiling.prototype._updateAllTiles = function() {
	try {
		// Set the position/size of all tiles
		if (this.active == true) {
			this.resizeScreen();
			for (var i = 0; i < this.layout.tiles.length; i++) {
				var newRect = this.layout.tiles[i].rectangle;
				if (! newRect) {
					return;
				}
				this.tiles[i].setGeometry(newRect);
			}
		}
	} catch(err) {
		print(err, "in Tiling._updateAllTiles");
	}
}

Tiling.prototype.resizeMaster = function(geometry) {
	try {
		if (this.layout.master > -1) {
			print("resizeMaster", geometry.x, geometry.y, geometry.width, geometry.height);
			this.layout.resizeTile(this.layout.master, geometry);
			this._updateAllTiles();
			print("New width:", this.tiles[this.layout.master].rectangle.width);
		} else {
			print("No master");
		}
	} catch(err) {
	}
}

Tiling.prototype.getMaster = function() {
	if (this.layout.master > -1) {
		return this.tiles[this.layout.master];
	} else {
		return null;
	}
}

Tiling.prototype.resizeScreen = function() {
	// FIXME: Probable kwin bug: clientArea returns the _former_ area
	var rect = Tiling.getTilingArea(this.screen, this.desktop);
	if (rect.x != this.screenRectangle.x ||
		rect.y != this.screenRectangle.y ||
		rect.width != this.screenRectangle.width ||
		rect.height != this.screenRectangle.height) {
		this.layout.screenRectangle.x = this.screenRectangle.x;
		this.layout.screenRectangle.y = this.screenRectangle.y;
		this.layout.screenRectangle.width = this.screenRectangle.width;
		this.layout.screenRectangle.height = this.screenRectangle.height;
		this.layout.setLayoutArea(rect);
		this.screenRectangle = rect;
	}
}
