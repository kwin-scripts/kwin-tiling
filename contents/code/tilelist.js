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
	if (client.tiling_connected == true) {
		return;
	}

    var self = this;

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

    client.tabGroupChanged.connect(function() {
        self._onClientTabGroupChanged(client);
    });
    // We also have to connect other client signals here instead of in Tile
    // because the tile of a client might change over time
    var getTile = function(client) {
        return self.tiles[client.tiling_tileIndex];
    };
    client.geometryShapeChanged.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientGeometryChanged(client);
		}
    });
    client.clientStartUserMovedResized.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientStartUserMovedResized(client);
		}
    });
	/*
    client.clientStepUserMovedResized.connect(function() {
		var tile = getTile(client);
		if (tile != null) {
			tile.onClientStepUserMovedResized(client);
		}
    });
	*/
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
			var tile = getTile(client);
			if (tile != null) {
				tile.onClientMinimizedChanged(client);
			}
		} catch(err) {
			print(err, "in mimimized");
		}
	});
	client.clientUnminimized.connect(function(client) {
		try {
			self._onClientAdded(client);
			var tile = getTile(client);
			if (tile != null) {
				tile.onClientMinimizedChanged(client);
			}
		} catch(err) {
			print(err, "in Unminimized");
		}
	});
	client.tiling_connected = true;
};
	
/**
 * Adds another client to the tile list. When this is called, the tile list also
 * adds callback functions to the relevant client signals to trigger tile change
 * events when necessary. This function might trigger a tileAdded event.
 *
 * @param client Client which is added to the tile list.
 */
TileList.prototype.addClient = function(client) {
    if (TileList._isIgnored(client)) {
		client.tileIndex = - 1;
        return;
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

	var noBorder = readConfig("noBorder", false);
	if (noBorder == true) {
		client.noBorder = true;
	}

	// Check whether the client is part of an existing tile
    var tileIndex = client.tiling_tileIndex;
    if (tileIndex >= 0 && tileIndex < this.tiles.length) {
		var notInTiles = true;
		for (var i=0; i< this.tiles.length; i++) {
			if (this.tiles[i] === client) {
				notInTiles = false;
				break;
			}
		}
		if (notInTiles) {
			this.tiles[tileIndex].clients.push(client);
		}
    } else {
        // If not, create a new tile
        this._addTile(client);
    }
	client.tiling_floating = false;
	assert(client.tiling_tileIndex >= 0, "Client added with invalid tileIndex");
};

TileList.prototype.retile = function() {
	var existingClients = workspace.clientList();
	var self = this;
	existingClients.forEach(function(client) {
		var tileIndex = client.tiling_tileIndex;
		if (tileIndex >= 0 && tileIndex < self.tiles.length) {
			self.addClient(client);
		}
	});
};

/**
 * Returns the tile in which a certain client is located.
 *
 * @param client Client for which the tile shall be returned.
 * @return Tile in which the client is located.
 */
TileList.prototype.getTile = function(client) {
    var tileIndex = client.tiling_tileIndex;
    if (tileIndex >= 0 && tileIndex < this.tiles.length) {
        return this.tiles[tileIndex];
    } else {
        return null;
    }
};

TileList.prototype._onClientAdded = function(client) {
    this._identifyNewTiles();
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
		var tileIndex = client.tiling_tileIndex;
		if (!(tileIndex >= 0 && tileIndex < this.tiles.length)) {
			return;
		}
		// Unset keepBelow because we set it when tiling
		client.keepBelow = false;
		// Remove the client from its tile
		var tile = this.tiles[tileIndex];
		if (tile.clients.length == 1) {
			// Remove the tile if this was the last client in it
			this._removeTile(tileIndex);
		} else {
			// Remove the client from its tile
			tile.clients.splice(tile.clients.indexOf(client), 1);
		}
		client.tiling_tileIndex = - 1;
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
    var tileIndex = client.tiling_tileIndex;
    var tile = this.tiles[tileIndex];
    if (tile.clients.length == 1) {
        // If this is the only client in the tile, the tile either does not
        // change or is destroyed
        this.tiles.forEach(function(otherTile) {
            if (otherTile != tile) {
                otherTile.syncCustomProperties();
            }
        });
        if (client.tiling_tileIndex != tileIndex) {
            this._removeTile(tileIndex);
            this.tiles[client.tiling_tileIndex].clients.push(client);
        }
    } else {
        tile.clients.splice(tile.clients.indexOf(client), 1);
        client.tiling_tileIndex = this.tiles.length;
        // Check whether the client has been added to an existing tile
        this._identifyNewTiles();
        if (client.tiling_tileIndex != this.tiles.length) {
            this.tiles[client.tiling_tileIndex].clients.push(client);
        } else {
            this._addTile(client);
        }
    }
};

TileList.prototype._addTile = function(client) {
    var newTile = new Tile(client, this.tiles.length)
    this.tiles.push(newTile);
    this.tileAdded.emit(newTile);
};

TileList.prototype._removeTile = function(tileIndex) {
    // Remove the tile if this was the last client in it
	var tile = this.tiles[tileIndex];
	this.tiles[tileIndex] = this.tiles[this.tiles.length - 1];
	this.tiles[tileIndex].tileIndex = tileIndex;
    this.tiles[tileIndex].syncCustomProperties();
    this.tileRemoved.emit(tile);
	this.tiles.length--;
};

/**
 * Updates the tile index on all clients in all existing tiles by synchronizing
 * the tiling_tileIndex property of the group. Clients which do not belong to
 * any existing tile will have this property set to null afterwards, while
 * clients which belong to a tile have the correct tile index.
 *
 * This can only detect clients which are not in any tile, it does not detect
 * client tab group changes! These shall be handled by removing the client from
 * any tile in _onClientTabGroupChanged() first.
 */
TileList.prototype._identifyNewTiles = function() {
    this.tiles.forEach(function(tile) {
        tile.syncCustomProperties();
    });
};

/**
 * Returns true for clients which shall not be handled by the tiling script at
 * all, e.g. the panel.
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
	if (client.dialog) {
		return true;
	}
	if (client.splash) {
		return true;
	}
	if (client.dock) {
		return true;
	}
	if (client.specialWindow == true) {
		return true;
	}
    return false;
};
