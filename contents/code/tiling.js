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
function Tiling(screenRectangle, layoutType, desktop, screen) {
	try {
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
		this.layout = new layoutType(screenRectangle);
		/**
		 * True if the layout is active.
		 */
		this.active = false;
		this.userActive = true;

		this.screenRectangle = screenRectangle;
		
		this.desktop = desktop;
		
		this.screen  = screen;
	} catch(err) {
		print(err, "in Tiling");
	}
}

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

Tiling.prototype.setLayoutArea = function(area) {
    this.layout.setLayoutArea(area);
    this._updateAllTiles();
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
			this.tiles.push(tile);
		}
		this._updateAllTiles();
		// TODO: Register tile callbacks
	} catch(err) {
		print(err, "in Tiling.addTile");
	}
}

Tiling.prototype.removeTile = function(tile) {
	try {
		var tileIndex = this.tiles.indexOf(tile);
		this.tiles.splice(tileIndex, 1);
		this.layout.removeTile(tileIndex);
		// TODO: Unregister tile callbacks
		this._updateAllTiles();
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
			this._updateAllTiles();
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
    // Unregister callbacks for all tiles
    // TODO
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

Tiling.prototype.getTileGeometry = function(x, y) {
	try {
		var index = this._getTileIndex(x, y);
		if (index != -1) {
			return this.layout.tiles[index];
		} else {
			return null;
		}
	} catch(err) {
		print(err, "in Tiling.getTileGeometry");
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

Tiling.prototype.getTiles = function() {
    // TODO
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
			var tileIndex = this.tiles.indexOf(tile);
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
		if (this.active) {
			// FIXME: KWin hands us the wrong area if we ask for our real desktop
			var rect = workspace.clientArea(KWin.PlacementArea, 0, this.screen);
			this.layout.onLayoutAreaChange(rect);
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
