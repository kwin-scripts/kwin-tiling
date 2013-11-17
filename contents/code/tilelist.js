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
 * Class which keeps track of all tiles in the system. The class automatically
 * puts tab groups in one single tile. Tracking of new and removed clients is
 * done here as well.
 * @class
 */
function TileList() {
    /**
     * List of currently existing tiles.
     */
    this.tiles = [];
    /**
     * Signal which is triggered whenever a new tile is added to the list.
     */
    this.tileAdded = new Signal();
    /**
     * Signal which is triggered whenever a tile is removed from the list.
     */
    this.tileRemoved = new Signal();

    // We connect to the global workspace callbacks which are triggered when
    // clients are added/removed in order to be able to keep track of the
    // new/deleted tiles
    var self = this;
    workspace.clientAdded.connect(function(client) {
		self._onClientAdded(client);
    });
    workspace.clientRemoved.connect(function(client) {
		self._onClientRemoved(client);
    });
}

TileList.prototype.connectSignals = function(client) {
	if (TileList._isIgnored(client)) {
		return;
	}

    var self = this;

	if (client.tiling_connected1 != true) {
		// First handle fullscreen and shade as they can change and affect the tiling or floating decision
		client.fullScreenChanged.connect(function() {
			if (client.fullScreen == true) {
				client.tiling_floating = true;
				client.keepAbove = true;
				self._onClientRemoved(client);
			} else {
				client.keepAbove = false;
				self._onClientAdded(client);
			}
		});
		client.shadeChanged.connect(function() {
			if (client.shade == true) {
				client.tiling_floating = true;
				self._onClientRemoved(client);
			} else {
				self.addClient(client);
			}
		});
		client.tiling_connected1 = true;
	}
	if (client.tiling_connected2 == true) {
		return;
	}
    client.tabGroupChanged.connect(function() {
        self._onClientTabGroupChanged(client);
    });
    // We also have to connect other client signals here instead of in Tile
    // because the tile of a client might change over time
    var getTile = function(client) {
        return self.getTile(client);
    };
    client.geometryShapeChanged.connect(function() {
		if (client.tiling_shown == true) {
			var tile = getTile(client);
			if (tile != null) {
				tile.onClientGeometryChanged(client);
			}
		}
    });
	client.windowShown.connect(function() {
		// Delay adding until the window is actually shown
		// This prevents graphics bugs
		// due to resizing before the pixmap is created (or something like that)
		if (client.tiling_shown != true) {
			client.tiling_shown = true;
			var tile = getTile(client);
			if (tile != null) {
				tile.onClientGeometryChanged(client);
			}
		}
	});
    client.clientStartUserMovedResized.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientStartUserMovedResized(client);
		}
    });
    client.clientStepUserMovedResized.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientStepUserMovedResized(client);
		}
    });
    client.clientFinishUserMovedResized.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientFinishUserMovedResized(client);
		}
    });
    client['clientMaximizedStateChanged(KWin::Client*,bool,bool)'].connect(
        function(client, h, v) {
			var tile = getTile(client);
			if (tile != null) {
				tile.onClientMaximizedStateChanged(client, h, v);
			}
		});
    client.desktopChanged.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientDesktopChanged(client);
		}
	});
	client.clientMinimized.connect(function(client) {
		try {
			self._onClientRemoved(client);
		} catch(err) {
			print(err, "in mimimized");
		}
	});
	client.clientUnminimized.connect(function(client) {
		try {
			self._onClientAdded(client);
		} catch(err) {
			print(err, "in Unminimized");
		}
	});
	client.tiling_connected2 = true;
};
	
/**
 * Adds another client to the tile list. When this is called, the tile list also
 * adds callback functions to the relevant client signals to trigger tile change
 * events when necessary. This function might trigger a tileAdded event.
 *
 * @param client Client which is added to the tile list.
 */
TileList.prototype.addClient = function(client) {
	if (client == null) {
		return;
	}
    if (TileList._isIgnored(client)) {
		client.tiling_tileIndex = -1;
		// WARNING: This crashes kwin!
		//client.tiling_floating = true;
        return;
    }

	var noBorder = readConfig("noBorder", false);
	if (noBorder == true) {
		client.noBorder = true;
	}

	this.connectSignals(client);

	// shade can't be activated without borders, so it's okay to handle it here
	if (client.fullScreen == true || client.shade == true) {
		client.keepBelow = false;
		client.keepAbove = true;
		return;
	}

	client.keepAbove = false;
	client.keepBelow = true;

	// Check whether the client is part of an existing tile
	if (this._indexWithClient(client) == -1) {
        this._addTile(client);
	}
	client.tiling_floating = false;
};

/**
 * Returns the tile in which a certain client is located.
 *
 * @param client Client for which the tile shall be returned.
 * @return Tile in which the client is located.
 */
TileList.prototype.getTile = function(client) {
	var index = this._indexWithClient(client);
	if (index > -1) {
		return this.tiles[index];
	}
	return null;
};

TileList.prototype._onClientAdded = function(client) {
    this.addClient(client);
};

TileList.prototype._onClientRemoved = function(client) {
	// HACK: Set this client to active even if it floats, as it can only be set floating when it is active (with FFM)
	var cactive = false;
	if (options.focusPolicy < 2) {
		if (workspace.activeClient == client) {
			cactive = true;
		}
	}
	try {
		// Unset keepBelow because we set it when tiling
		client.keepBelow = false;

		// Remove the client from its tile
		var tileIndex = this._indexWithClient(client);
		var tile = this.tiles[tileIndex];
		if (tile != null) {
			if (tile.clients.length == 1) {
				// Remove the tile if this was the last client in it
				this._removeTile(tileIndex);
			} else {
				// Remove the client from its tile
				tile.removeClient(client);
			}
		}
		// Don't remove tileIndex, so we can move the window to its position in case it comes back (after minimize etc)
		//client.tiling_tileIndex = - 1;
		if (client.tiling_floating == true) {
			client.noBorder = false;
			if (cactive == true) {
				workspace.activeClient = client;
			}
		}
	} catch(err) {
		print(err, "in onClientRemoved with", client.resourceClass.toString());
	}
};

TileList.prototype._onClientTabGroupChanged = function(client) {
	try {
		// FIXME: This is a huge kludge as kwin doesn't actually export the tabgroup
		// For starters, this only works because we ignore geometryChanged for clients that aren't the current tab
		var index = this._indexWithClient(client);
		if (client.isCurrentTab == false) {
			var tabGroup = null;
			for (i = 0; i < this.tiles.length; i++) {
				// We don't set geometry if the client isn't currentTab, so find its tabgroup by place
				var rect  = this.tiles[i].rectangle;
				if (rect != null && rect.x == client.geometry.x &&
					rect.y == client.geometry.y &&
					rect.width == client.geometry.width &&
					rect.height == client.geometry.height) {
					// TODO: Is this necessary or is desktopChanged always called before tabgroupchanged?
					if (this.tiles[i]._currentDesktop == client.desktop || client.desktop == -1) {
						tabGroup = this.tiles[i];
						break;
					}
				}
			}
			if (index > -1) {
				this.tiles[index].removeClient(client);
				if (this.tiles[index].clients.length < 1) {
					this._removeTile(index);
				}
			}
			if (tabGroup != this.tiles[index]) {
				tabGroup.addClient(client);
			} else {
				tabGroup.removeClient(client);
				if (tabGroup.clients.length < 1) {
					this._removeTile(this.tiles.indexOf(tabGroup));
				}
			}
		} else {
			if (index > -1) {
				if (this.tiles[index].clients.length > 1) {
					this.tiles[index].removeClient(client);
					this.addClient(client);
				}
			}
		}
	} catch(err) {
		print(err, "in TileList._onClientTabGroupChanged");
	}
};

TileList.prototype._addTile = function(client) {
	var tileIndex = this.tiles.length;
	if (client.tiling_tileIndex > -1) {
		tileIndex = client.tiling_tileIndex;
	}
	var newTile = new Tile(client, tileIndex);
    this.tiles.push(newTile);
    this.tileAdded.emit(newTile);
};

TileList.prototype._removeTile = function(tileIndex) {
	try {
		// Don't modify tileIndex here - this is a list of _all_ tiles, while tileIndex is the index on the desktop
		var tile = this.tiles[tileIndex];
		if (tileIndex > -1) {
			this.tiles.splice(tileIndex, 1);
		}
		this.tileRemoved.emit(tile);
	} catch(err) {
		print(err, "in TileList._removeTile");
	}
};

/**
 * Returns true for clients which shall never be handled by the tiling script,
 * e.g. panels, dialogs or the user-defined apps
 */
TileList._isIgnored = function(client) {
    // Application workarounds should be put here
	// Qt gives us a method-less QVariant(QStringList) if we ask for an array
	// Ask for a string instead (which can and should still be a StringList for the UI)
	var fl = "yakuake,krunner,Plasma,Plasma-desktop,plasma-desktop,Plugin-container,plugin-container,Wine";
	// TODO: This could break if an entry contains whitespace or a comma - it needs to be validated on the qt side
	var floaters = String(readConfig("floaters", fl)).replace(/ /g,"").split(",");
	if (floaters.indexOf(client.resourceClass.toString()) > -1) {
		client.syncTabGroupFor("kwin_tiling_floats", true);
		return true;
	}
	if (client.specialWindow == true) {
		return true;
	}
	if (client.desktopWindow == true) {
		return true;
	}
	if (client.dock == true) {
		return true;
	}
	if (client.toolbar == true) {
		return true;
	}
	if (client.menu == true) {
		return true;
	}
	if (client.dialog == true) {
		return true;
	}
	if (client.splash == true) {
		return true;
	}
	if (client.utility == true) {
		return true;
	}
	if (client.dropdownMenu == true) {
		return true;
	}
	if (client.popupMenu == true) {
		return true;
	}
	if (client.tooltip == true) {
		return true;
	}
	if (client.notification == true) {
		return true;
	}
	if (client.comboBox == true) {
		return true;
	}
	if (client.dndIcon == true) {
		return true;
	}

    return false;
};

TileList.prototype._indexWithClient = function(client) {
	for (i = 0; i < this.tiles.length; i++) {
		if (this.tiles[i].hasClient(client)) {
			return i;
		}
	}
	return -1;
}
