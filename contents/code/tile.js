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
 * Class which manages the windows in one tile and handles resize/move and
 * property change events.
 * @class
 */
function Tile(firstClient, tileIndex) {
	try {
		/**
		 * Signal which is triggered whenever the user starts to move the tile.
		 */
		this.movingStarted = new Signal();
		/**
		 * Signal which is triggered whenever the user stops moving the tile.
		 */
		this.movingEnded = new Signal();
		/**
		 * Signal which is triggered whenever the geometry changes between
		 * movingStarted and movingEnded.
		 */
		this.movingStep = new Signal();
		/**
		 * Signal which is triggered whenever the user starts to resize the tile.
		 */
		this.resizingStarted = new Signal();
		/**
		 * Signal which is triggered whenever the user stops resizing the tile.
		 */
		this.resizingEnded = new Signal();
		/**
		 * Signal which is triggered whenever the geometry changes between
		 * resizingStarted and resizingEnded.
		 */
		this.resizingStep = new Signal();
		/**
		 * Signal which is triggered when the geometry of the tile changes because
		 * of something different to a user move or resize action.
		 */
		this.geometryChanged = new Signal();
		/**
		 * Signal which is triggered whenever the tile is moved to a different
		 * screen. Two parameters are passed to the handlers, the old and the new
		 * screen.
		 */
		this.screenChanged = new Signal();
		/**
		 * Signal which is triggered whenever the tile is moved to a different
		 * desktop. Two parameters are passed to the handlers, the old and the new
		 * desktop.
		 */
		this.desktopChanged = new Signal();
		/**
		 * List of the clients in this tile.
		 */
		this.clients = [firstClient];
		/**
		 * Index of this tile in the TileList to which the tile belongs.
		 */
		this.tileIndex = tileIndex;
		/**
		 * True if this tile is currently moved by the user.
		 */
		this._moving = false;
		/**
		 * True if this tile is currently moved by the user.
		 */
		this._resizing = false;
		/**
		 * Stores the current screen of the tile in order to be able to detect
		 * movement between screens.
		 */
		this._currentScreen = firstClient.screen;

		/**
		 * Stores the current desktop as this is needed as a desktopChanged
		 * parameter.
		 */
		this._currentDesktop = firstClient.desktop;

		this.rectangle = null;

		this.syncCustomProperties();
	} catch(err) {
		print(err, "in Tile");
	}
}

/**
 * Sets the geometry of the tile. geometryChanged events caused by this function
 * are suppressed.
 *
 * @param geometry New tile geometry.
 */
Tile.prototype.setGeometry = function(geometry) {
	try {
		if (geometry == null) {
			return;
		}
		this.rectangle = geometry;
		for(i = 0; i < this.clients.length; i++) {
			this.clients[i].geometry = geometry;
		}
	} catch(err) {
		print(err, "in Tile.setGeometry");
	}
};

Tile.prototype.resetGeometry = function() {
	this.setGeometry(this.rectangle);
};

/**
 * Saves the current geometry so that it can later be restored using
 * restoreGeometry().
 */
Tile.prototype.saveGeometry = function() {
    if (this._savedGeometry != null) {
        this._savedGeometry = this.clients[0].geometry;
    }
    // TODO: Inhibit geometryChanged events?
};

/**
 * Restores the previously saved geometry.
 */
Tile.prototype.restoreGeometry = function() {
	try {
		this.clients[0].geometry = this._savedGeometry;
	} catch(err) {
		print(err, "in restoreGeometry");
	}
    // TODO: Inhibit geometryChanged events?
};

/**
 * Returns the currently active client in the tile.
 */
Tile.prototype.getActiveClient = function() {
	try {
		var active;
		this.clients.forEach(function(client) {
			if (client.isCurrentTab) {
				active = client;
			}
		});
		return active;
	} catch(err) {
		print(err, "in Tile.getActiveClient");
	}
};

/**
 * Synchronizes all custom properties (tileIndex, floating between all clients
 * in the tile).
 */
Tile.prototype.syncCustomProperties = function() {
	try {
		this.clients[0].tiling_tileIndex = this.tileIndex;
		this.clients[0].syncTabGroupFor("tiling_tileIndex", true);
		this.clients[0].syncTabGroupFor("tiling_floating", true);
		this.clients[0].syncTabGroupFor("fullScreen", true);
	} catch(err) {
		print(err, "in Tile.syncCustomProperties");
	}
};

Tile.prototype.onClientGeometryChanged = function(client) {
	try {
		if (!client.isCurrentTab) {
			return;
		}
		// If the screen has changed, send an event and reset the saved geometry
		if (client.screen != this._currentScreen) {
			this._currentScreen = client.screen;
			this._savedGeometry = null;
			this.screenChanged.emit();
		}
		if (client.move || client.resize) {
			return;
		}
		if (this._moving || this.resizing) {
			return;
		}
		if (this.rectangle != null) {
			// Workaround an infinite signal loop by setting this in pieces
			client.geometry.x = this.rectangle.x;
			client.geometry.y = this.rectangle.y;
			client.geometry.width = this.rectangle.width;
			client.geometry.height = this.rectangle.height;
		}
		// TODO: Check whether we caused the geometry change
		this.geometryChanged.emit();
	} catch(err) {
		print(err, "in Tile.onClientGeometryChanged");
	}
};

Tile.prototype.onClientDesktopChanged = function(client) {
	try {
		if (!client.isCurrentTab) {
			return;
		}
		var oldDesktop = this._currentDesktop;
		this._currentDesktop = client.desktop;
		this.desktopChanged.emit(oldDesktop, this._currentDesktop);
	} catch(err) {
		print(err, "in Tile.onClientDesktopChanged");
	}
};

Tile.prototype.onClientStartUserMovedResized = function(client) {
};

Tile.prototype.onClientStepUserMovedResized = function(client) {
	try {
		if (client.resize) {
			this.resizingStep.emit();
			// This means it gets animated
			this.resizingEnded.emit();
			this._resizing = true;
			return;
		}
		if (client.move) {
			this.movingStep.emit();
			this._moving = true;
			return;
		}
	} catch(err) {
		print(err, "in Tile.onClientStepUserMovedResized");
	}
};

Tile.prototype.onClientFinishUserMovedResized = function(client) {
	try {
		if (this._moving) {
			this.movingEnded.emit();
			this._moving = false;
		} else if (this._resizing) {
			this.resizingEnded.emit();
			this._resizing = false;
		}
	} catch(err) {
		print(err, "in Tile.onClientFinishUserMovedResized");
	}
};
