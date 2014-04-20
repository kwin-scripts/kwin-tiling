/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012 Mathias Gottschlag <mgottschlag@gmail.com>
Copyright (C) 2013-2014 Fabian Homborg <FHomborg@gmail.com>

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
};

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
		if (this.rectangle == null) {
			this.rectangle = util.copyRect(geometry);
		} else {
			util.setRect(this.rectangle, geometry);
		}
		for (var i = 0; i < this.clients.length; i++) {
			this.clients[i].tiling_MoveResize = false;
			this.onClientGeometryChanged(this.clients[i]);
		}
	} catch(err) {
		print(err, "in Tile.setGeometry");
	}
};

Tile.prototype.resetGeometry = function() {
	this.setGeometry(this.rectangle);
};

/**
 * Returns the currently active client in the tile.
 */
Tile.prototype.getActiveClient = function() {
	try {
		var active = null;
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
		var client = this.getActiveClient();
		if (client == null) {
			client = this.clients[0];
		}
		if (client != null) {
			client.tiling_tileIndex = this.tileIndex;
			client.syncTabGroupFor("tiling_tileIndex", true);
			client.syncTabGroupFor("tiling_floating", true);
		}
	} catch(err) {
		print(err, "in Tile.syncCustomProperties");
	}
};

Tile.prototype.onClientGeometryChanged = function(client) {
		this.setClientGeometry(client);
};

Tile.prototype.setAllClientGeometries = function() {
	var self = this;
	this.clients.forEach(function(client) {
		self.setClientGeometry(client);
	});
};

Tile.prototype.setClientGeometry = function(client) {
	try {
		if (client == null) {
			return;
		}
		if (client.tiling_tileIndex != this.tileIndex) {
			print("Wrong tile called");
			return;
		}
		// Don't resize when client isn't on current desktop
		// Prevents a couple unnecessary resizes
		if (client.desktop != workspace.currentDesktop && client.desktop > -1) {
			return;
		}
		// These two should never be reached
		if (client.deleted == true) {
			return;
		}
		if (client.managed == false) {
			return;
		}
		if (!client.isCurrentTab) {
			return;
		}
		// If the screen has changed, send an event
		if (client.screen != this._currentScreen) {
			this._currentScreen = client.screen;
			this.screenChanged.emit();
		}
		if (client.move || client.resize) {
			return;
		}
		if (this._moving || this._resizing) {
			return;
		}
		if (client.resizeable != true) {
			return;
		}
		if (client.moveable != true) {
			return;
		}
		if (client.minSize.w == client.maxSize.w && client.minSize.h == client.maxSize.w) {
			return;
		}
		if (this.rectangle != null) {
			if (util.compareRect(this.rectangle, client.geometry) == false) {
				client.tiling_resize = true;
				// Respect min/maxSize
				var changedRect = false;
				var screenRect = util.getTilingArea(this._currentScreen, this._currentDesktop);
				if (client.minSize.w > this.rectangle.width) {
					if (this.rectangle.x + this.rectangle.width == screenRect.x + screenRect.width) {
						this.rectangle.x = (screenRect.x + screenRect.width) - client.minSize.w;
					}
					this.rectangle.width = client.minSize.w;
					changedRect = true;
				}
				if (client.minSize.h > this.rectangle.height) {
					if (this.rectangle.y + this.rectangle.height == screenRect.y + screenRect.height) {
						this.rectangle.y = (screenRect.y + screenRect.height) - client.minSize.h;
					}
					this.rectangle.height = client.minSize.h;
					changedRect = true;
				}
				if (client.maxSize.w < this.rectangle.width && client.maxSize.w > 0) {
					if (this.rectangle.x + this.rectangle.width == screenRect.x + screenRect.width) {
						this.rectangle.x = (screenRect.x + screenRect.width) - client.maxSize.w;
					}
					this.rectangle.width = client.maxSize.w;
					changedRect = true;
				}
				if (client.maxSize.h < this.rectangle.height && client.maxSize.h > 0) {
					if (this.rectangle.y + this.rectangle.height == screenRect.y + screenRect.height) {
						this.rectangle.y = (screenRect.y + screenRect.height) - client.maxSize.h;
					}
					this.rectangle.height = client.maxSize.h;
					changedRect = true;
				}
				// Don't accidentally maximize windows
				var eBM = options.electricBorderMaximize;
				options.electricBorderMaximize = false;
				client.geometry = util.copyRect(this.rectangle);
				options.electricBorderMaximize = eBM;

				if (changedRect == true) {
					this._resizing = true;
					this.resizingEnded.emit();
					this._resizing = false;
				}

				client.tiling_resize = false;
			}
		} else {
			print("No rectangle", client.resourceClass.toString(), client.windowId);
		}
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
			this._resizing = true;
			this.resizingStep.emit();
			// This means it gets animated
			this.resizingEnded.emit();
			return;
		}
		if (client.move) {
			this._moving = true;
			this.movingStep.emit();
			this.movingEnded.emit();
			return;
		}
	} catch(err) {
		print(err, "in Tile.onClientStepUserMovedResized");
	}
};

Tile.prototype.onClientFinishUserMovedResized = function(client) {
	try {
		if (this._moving) {
			this._moving = false;
			this.movingEnded.emit();
		} else if (this._resizing) {
			this._resizing = false;
			this.resizingEnded.emit();
		}
	} catch(err) {
		print(err, "in Tile.onClientFinishUserMovedResized");
	}
};

Tile.prototype.removeClient = function(client) {
	try {
		this.clients.splice(this.clients.indexOf(client), 1);
	} catch(err) {
		print(err, "in Tile.removeClient");
	}
};

Tile.prototype.addClient = function(client) {
	try {
		if (this.clients.indexOf(client) == -1) {
			this.clients.push(client);
			this.syncCustomProperties();
			this.onClientGeometryChanged(client);
		}
	} catch(err) {
		print(err, "in Tile.addClient");
	}
};

Tile.prototype.onClientMaximizedStateChanged = function(client, h, v) {
	try {
		var screenRect = workspace.clientArea(KWin.PlacementArea, this._currentScreen, this._currentDesktop);
		var newRect = util.copyRect(this.rectangle);
		if (h) {
			newRect.x = screenRect.x;
			newRect.width = screenRect.width;
		} else {
			if (this.oldRect != null) {
				newRect.x = this.oldRect.x;
				newRect.width = this.oldRect.width;
			}
		}
		if (v) {
			newRect.y = screenRect.y;
			newRect.height = screenRect.height;
		} else {
			if (this.oldRect != null) {
				newRect.y = this.oldRect.y;
				newRect.height = this.oldRect.height;
			}
		}
		this.oldRect = util.copyRect(this.rectangle);
		this.setGeometry(newRect);
	} catch(err) {
		print(err, "in tile.onClientMaximizedStateChanged");
	}
};

Tile.prototype.hasClient = function(client) {
	return (this.clients.indexOf(client) > -1);
};

