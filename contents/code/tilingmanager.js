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

Qt.include("signal.js");
Qt.include("tile.js");
Qt.include("tilelist.js");
Qt.include("layout.js");
Qt.include("spirallayout.js");
Qt.include("halflayout.js");
Qt.include("bladelayout.js");
Qt.include("tiling.js");
Qt.include("tests.js");


/**
 * Class which manages all layouts, connects the various signals and handlers
 * and implements all keyboard shortcuts.
 * @class
 */
function TilingManager() {
    /**
     * Default layout type which is selected for new layouts.
     */
    this.defaultLayout = HalfLayout;

    /**
     * List of all available layout types.
     */
    this.availableLayouts = [
		HalfLayout,
		BladeLayout,
        SpiralLayout/*,
					  ZigZagLayout,
					  ColumnLayout,
					  RowLayout,
					  GridLayout,
					  MaximizedLayout,
					  FloatingLayout*/
    ];
    for (var i = 0; i < this.availableLayouts.length; i++) {
        this.availableLayouts[i].index = i;
    }
    /**
     * Number of desktops in the system.
     */
    this.desktopCount = workspace.desktopGridWidth
        * workspace.desktopGridHeight;
    /**
     * Number of screens in the system.
     */
    this.screenCount = workspace.numScreens;
    /**
     * Array containing a list of layouts for every desktop. Each of the lists
     * has one element per screen.
     */
    this.layouts = [];
    /**
     * List of all tiles in the system.
     */
    this.tiles = new TileList();
    /**
     * Current screen, needed to be able to track screen changes.
     */
    this._currentScreen = workspace.activeScreen;
    /**
     * Current desktop, needed to be able to track screen changes.
     */
    this._currentDesktop = workspace.currentDesktop - 1;
    /**
     * True if a user moving operation is in progress.
     */
    this._moving = false;
    /**
     * The screen where the current window move operation started.
     */
    this._movingStartScreen = 0;
	
	// Read layout configuration
	// Format: desktop:layoutname[,...]
	// Negative desktop number deactivates tiling
	this.layoutConfig = [];
	var lC = String(readConfig("layouts", "")).replace(/ /g,"").split(",");
	for (i = 0; i < lC.length; i++) {
		var layout = lC[i].split(":");
		try {
			var desktop = parseInt(layout[0]);
		} catch (err) {
			continue;
		}
		var l = this.defaultLayout;
		for (j = 0; j < this.availableLayouts.length; j++) {
			if (this.availableLayouts[j].name == layout[1]) {
				l = this.availableLayouts[j];
			}
		}
		if (desktop < 0) {
			var tiling = false;
			desktop = desktop * -1;
		} else {
			var tiling = true;
		}
		if (desktop == 0) {
			this.defaultLayout = l;
		}
		// Subtract 1 because the config is in user-indexed format
		desktop = desktop - 1;
		var desktoplayout = {};
		desktoplayout.desktop = desktop;
		desktoplayout.layout = l;
		desktoplayout.tiling = tiling;
		this.layoutConfig.push(desktoplayout);
	}

    // Create the various layouts, one for every desktop
    for (var i = 0; i < this.desktopCount; i++) {
        this._createDefaultLayouts(i);
    }

    var self = this;
    // Connect the tile list signals so that new tiles are added to the layouts
    this.tiles.tileAdded.connect(function(tile) {
        self._onTileAdded(tile);
    });
    this.tiles.tileRemoved.connect(function(tile) {
        self._onTileRemoved(tile);
    });

	var existingClients = workspace.clientList();
	existingClients.forEach(function(client) {
		self.tiles.addClient(client);
		// Don't reset floating so we don't lose the value over restarts
		//client.tiling_floating = null;
	});
	// Activate the visible layouts
	// Do it after adding the existingClients to prevent unnecessary geometry changes
	this.layouts[workspace.currentDesktop - 1].forEach(function(layout) {
		layout.activate();
	});

    // Register global callbacks
    workspace.numberDesktopsChanged.connect(function() {
        self._onNumberDesktopsChanged();
    });
    workspace.numberScreensChanged.connect(function() {
        self._onNumberScreensChanged();
    });
	workspace.screenResized.connect(function(screen) {
		try {
			self._onScreenResized(screen);
		} catch(err) {
			print(err);
		}
	});
    workspace.currentDesktopChanged.connect(function() {
        self._onCurrentDesktopChanged();
    });
    // Register keyboard shortcuts
    registerShortcut("Next Tiling Layout",
                     "Next Tiling Layout",
                     "Meta+PgDown",
                     function() {
						 var currentLayout = self._getCurrentLayoutType();
						 var nextIndex = (currentLayout.index + 1) % self.availableLayouts.length;
						 self._switchLayout(workspace.currentDesktop - 1,
											workspace.activeScreen,
											nextIndex);
					 });
    registerShortcut("Previous Tiling Layout",
                     "Previous Tiling Layout",
                     "Meta+PgUp",
                     function() {
						 var currentLayout = self._getCurrentLayoutType();
						 var nextIndex = currentLayout.index - 1;
						 if (nextIndex < 0) {
							 nextIndex += self.availableLayouts.length;
						 }
						 self._switchLayout(workspace.currentDesktop - 1,
											workspace.activeScreen,
											nextIndex);
					 });
    registerShortcut("Toggle Floating",
                     "Toggle Floating",
                     "Meta+F",
                     function() {
						 var client = workspace.activeClient;
						 if (client == null) {
							 print("No active client");
							 return;
						 }
						 client.tiling_floating = !client.tiling_floating;
						 if (client.tiling_floating == true) {
							 self.tiles._onClientRemoved(client);
						 } else {
							 self.tiles.addClient(client);
						 }
					 });
    registerShortcut("Toggle Border",
                     "Toggle Border",
                     "Meta+U",
                     function() {
						 var client = workspace.activeClient;
						 if (client == null) {
							 print("No active client");
							 return;
						 }
						 client.noBorder = ! client.noBorder;
					 });
	registerShortcut("Toggle Border for all",
					 "Toggle Border for all",
					 "Meta+Shift+U",
					 function() {
						 self.tiles.toggleNoBorder()
					 });
    registerShortcut("Switch Focus Left",
                     "Switch Focus Left",
                     "Meta+H",
                     function() {
						 self._switchFocus(Direction.Left);
					 });
    registerShortcut("Switch Focus Right",
                     "Switch Focus Right",
                     "Meta+L",
                     function() {
						 self._switchFocus(Direction.Right);
					 });
    registerShortcut("Switch Focus Up",
                     "Switch Focus Up",
                     "Meta+K",
                     function() {
						 self._switchFocus(Direction.Up);
					 });
    registerShortcut("Switch Focus Down",
                     "Switch Focus Down",
                     "Meta+J",
                     function() {
						 self._switchFocus(Direction.Down);
					 });
    registerShortcut("Move Window Left",
                     "Move Window Left",
                     "Meta+Shift+H",
                     function() {
						 self._moveTile(Direction.Left);
					 });
    registerShortcut("Move Window Right",
                     "Move Window Right",
                     "Meta+Shift+L",
                     function() {
						 self._moveTile(Direction.Right);
					 });
    registerShortcut("Move Window Up",
                     "Move Window Up",
                     "Meta+Shift+K",
                     function() {
						 self._moveTile(Direction.Up);
					 });
    registerShortcut("Move Window Down",
                     "Move Window Down",
                     "Meta+Shift+J",
                     function() {
						 self._moveTile(Direction.Down);
					 });
	registerShortcut("Toggle Tiling",
					 "Toggle Tiling",
					 "Meta+Shift+f11",
					 function() {
						 var currentScreen = workspace.activeScreen;
						 var currentDesktop = workspace.currentDesktop - 1;
						 self.layouts[currentDesktop][currentScreen].toggleUserActive();
					 });
	registerShortcut("Swap Window With Master",
					 "Swap Window With Master",
					 "Meta+Shift+M",
					 function() {
						 try {
							 var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
							 if (layout != null) {
								 var client = workspace.activeClient;
								 if (client != null) {
									 var tile = layout.getTile(client.x, client.y);
								 }
							 }
							 if (tile != null) {
								 layout.swapTiles(tile, layout.tiles[0]);
							 }
						 } catch(err) {
							 print(err, "in swap-window-with-master");
						 }
					 });
	registerShortcut("Resize Active Window To The Left",
					 "Resize Active Window To The Left",
					 "Meta+Alt+H",
					 function() {
						 try {
							 var tile = self._getMaster(self._currentScreen, self._currentDesktop);
							 // Qt.rect automatically clamps negative values to zero
							 geom = Qt.rect(tile.rectangle.x - 10,
											tile.rectangle.y,
											tile.rectangle.width - 10,
											tile.rectangle.height);
							 if (geom.x < 0) {
								 geom.x = 0;
							 }
							 self.layouts[tile._currentDesktop - 1][tile._currentScreen].resizeMaster(geom);
						 } catch(err) {
							 print(err, "in resize-window-to-the-left");
						 }
					 });
	registerShortcut("Resize Active Window To The Right",
					 "Resize Active Window To The Right",
					 "Meta+Alt+L",
					 function() {
						 try {
							 var tile = self._getMaster(self._currentScreen, self._currentDesktop);
							 // Qt.rect automatically clamps negative values to zero
							 geom = Qt.rect(tile.rectangle.x,
											tile.rectangle.y,
											tile.rectangle.width + 10,
											tile.rectangle.height);
							 self.layouts[tile._currentDesktop - 1][tile._currentScreen].resizeMaster(geom);
						 } catch(err) {
							 print(err, "in resize-window-to-the-left");
						 }
					 });
	registerShortcut("Resize Active Window To The Top",
					 "Resize Active Window To The Top",
					 "Meta+Alt+K",
					 function() {
						 try {
							 var tile = self._getMaster(self._currentScreen, self._currentDesktop);
							 // Qt.rect automatically clamps negative values to zero
							 geom = Qt.rect(tile.rectangle.x,
											tile.rectangle.y - 10,
											tile.rectangle.width,
											tile.rectangle.height + 10);
							 self.layouts[tile._currentDesktop - 1][tile._currentScreen].resizeMaster(geom);
						 } catch(err) {
							 print(err, "in resize-window-to-the-left");
						 }
					 });
	registerShortcut("Resize Active Window To The Bottom",
					 "Resize Active Window To The Bottom",
					 "Meta+Alt+J",
					 function() {
						 try {
							 var tile = self._getMaster(self._currentScreen, self._currentDesktop);
							 // Qt.rect automatically clamps negative values to zero
							 geom = Qt.rect(tile.rectangle.x,
											tile.rectangle.y,
											tile.rectangle.width,
											tile.rectangle.height - 10);
							 self.layouts[tile._currentDesktop - 1][tile._currentScreen].resizeMaster(geom);
						 } catch(err) {
							 print(err, "in resize-window-to-the-left");
						 }
					 });
	registerUserActionsMenu(function(client) {
		return {
			text : "Toggle floating",
			triggered: function () {
				client.tiling_floating = ! client.tiling_floating;
				if (client.tiling_floating == true) {
					self.tiles._onClientRemoved(client);
				} else {
					self.tiles.addClient(client);
				}
			}
		};
	});
}

TilingManager.prototype._createDefaultLayouts = function(desktop) {
    var screenLayouts = [];
	var layout = this.defaultLayout;
	var tiling = true;
	for (var i = 0; i < this.layoutConfig.length; i++) {
		if (this.layoutConfig[i].desktop == desktop) {
			layout = this.layoutConfig[i].layout;
			tiling = this.layoutConfig[i].tiling;
			this.layoutConfig.splice(i,1);
		}
	}
    for (var j = 0; j < this.screenCount; j++) {
        screenLayouts[j] = new Tiling(layout, desktop, j);
		screenLayouts[j].userActive = tiling;
    }
    this.layouts[desktop] = screenLayouts;
};

TilingManager.prototype._getCurrentLayoutType = function() {
    var currentLayout = this.layouts[this._currentDesktop][this._currentScreen];
    return currentLayout.layoutType;
};

TilingManager.prototype._onTileAdded = function(tile) {
    // Add tile callbacks which are needed to move the tile between different
    // screens/desktops
	var self = this;
	tile.screenChanged.connect(function(oldScreen, newScreen) {
		self._onTileScreenChanged(tile, oldScreen, newScreen);
	});
	tile.desktopChanged.connect(function(oldDesktop, newDesktop) {
		self._onTileDesktopChanged(tile, oldDesktop, newDesktop);
	});
	tile.movingStarted.connect(function() {
		self._onTileMovingStarted(tile);
	});
	tile.movingEnded.connect(function() {
		self._onTileMovingEnded(tile);
	});
	tile.resizingEnded.connect(function() {
		self._onTileResized(tile);
	});
	// Add the tile to the layouts
	var tileLayouts = this._getLayouts(tile._currentDesktop, tile._currentScreen);
	tileLayouts.forEach(function(layout) {
		layout.addTile(tile);
	});
};

TilingManager.prototype._onTileResized = function(tile) {
	var tileLayouts = this._getLayouts(tile._currentDesktop, tile._currentScreen);
	tileLayouts.forEach(function(layout) {
		layout.resizeTile(tile);
	});
};

TilingManager.prototype._getMaster = function(screen, desktop) {
	try {
		return this.layouts[desktop][screen].getMaster();
	} catch(err) {
		print(err, "in _getMaster");
	}
}

TilingManager.prototype._onTileRemoved = function(tile) {
	try {
		var tileLayouts = this._getLayouts(tile._currentDesktop, tile._currentScreen);
		tileLayouts.forEach(function(layout) {
			layout.removeTile(tile);
		});
	} catch(err) {
		print(err, "in TilingManager._onTileRemoved");
	}
};

TilingManager.prototype._onNumberDesktopsChanged = function() {
	var newDesktopCount =
		workspace.desktopGridWidth * workspace.desktopGridHeight;
	var onAllDesktops = tiles.tiles.filter(function(tile) {
		return tile.desktop == -1;
	});
	// Remove tiles from desktops which do not exist any more (we only have to
	// care about tiles shown on all desktops as all others have been moved away
	// from the desktops by kwin before)
	for (var i = newDesktopCount; i < this.desktopCount; i++) {
		onAllDesktops.forEach(function(tile) {
			this.layouts[i][tile.screen].removeTile(tile);
		});
	}
	// Add new desktops
	for (var i = this.desktopCount; i < newDesktopCount; i++) {
		this._createDefaultLayouts(i);
		onAllDesktops.forEach(function(tile) {
			this.layouts[i][tile.screen].addTile(tile);
		});
	}
	// Remove deleted desktops
	if (this.desktopCount > newDesktopCount) {
		layouts.length = newDesktopCount;
	}
	this.desktopCount = newDesktopCount;
};

TilingManager.prototype._onNumberScreensChanged = function() {
	// Add new screens
	if (this.screenCount < workspace.numScreens) {
		for (var i = 0; i < this.desktopCount; i++) {
			for (var j = this.screenCount; j < workspace.numScreens; j++) {
				this.layouts[i][j] = new Tiling(this.defaultLayout, i, j);
				// Activate the new layout if necessary
				if (i == workspace.currentDesktop - 1) {
					this.layouts[i][j].activate();
				}
			}
		}
	}
	// Remove deleted screens
	if (this.screenCount > workspace.numScreens) {
		for (var i = 0; i < this.desktopCount; i++) {
			this.layouts[i].length = workspace.numScreens;
		}
	}
	this.screenCount = workspace.numScreens;
};

TilingManager.prototype._onScreenResized = function(screen) {
	if (screen < this.screenCount) {
		for (var i = 0; i < this.desktopCount; i++) {
			this.layouts[i][screen].activate();
		}
	}
};

TilingManager.prototype._onTileScreenChanged =
    function(tile, oldScreen, newScreen) {
		// If a tile is moved by the user, screen changes are handled in the move
		// callbacks below
		if (this._moving) {
			return;
		}
		var client = tile.clients[0];
		var oldLayouts = this._getLayouts(client.desktop, oldScreen);
		var newLayouts = this._getLayouts(client.desktop, newScreen);
		this._changeTileLayouts(tile, oldLayouts, newLayouts);
	};

TilingManager.prototype._onTileDesktopChanged =
    function(tile, oldDesktop, newDesktop) {
		try {
			var client = tile.clients[0];
			var oldLayouts = this._getLayouts(oldDesktop, client.screen);
			var newLayouts = this._getLayouts(newDesktop, client.screen);
			if (oldDesktop == -1) {
				oldLayouts.splice(newDesktop - 1, 1);
				newLayouts.splice(newDesktop - 1, 1);
			}
			this._changeTileLayouts(tile, oldLayouts, newLayouts);
		} catch(err) {
			print(err, "in TilingManager._onTileDesktopChanged");
		}
	};

TilingManager.prototype._onTileMovingStarted = function(tile) {
	// NOTE: This supports only one moving window, breaks with multitouch input
	this._moving = true;
	this._movingStartScreen = tile.clients[0].screen;
}

TilingManager.prototype._onTileMovingEnded = function(tile) {
	try {
		var client = tile.clients[0];
		this._moving = false;
		var movingEndScreen = client.screen;
		var windowRect = client.geometry;
		if (client.tiling_tileIndex >= 0) {
			if (this._movingStartScreen != movingEndScreen) {
				// Transfer the tile from one layout to another layout
				var startLayout =
					this.layouts[this._currentDesktop][this._movingStartScreen];
				var endLayout = this.layouts[this._currentDesktop][client.screen];
				startLayout.removeTile(tile);
				endLayout.addTile(tile, windowRect.x + windowRect.width / 2,
								  windowRect.y + windowRect.height / 2);
			} else {
				// Transfer the tile to a different location in the same layout
				var layout = this.layouts[this._currentDesktop][client.screen];
				var targetTile = layout.getTile(windowRect.x + windowRect.width / 2,
												windowRect.y + windowRect.height / 2);
				// In case no tile is found (e.g. middle of the window is offscreen), move the client back
				if (targetTile == null) {
					targetTile = tile;
				}
				// swapTiles() works correctly even if tile == targetTile
				layout.swapTiles(tile, targetTile);
			}
		}
	} catch(err) {
		print(err, "in TilingManager._onTileMovingEnded");
	}
}

TilingManager.prototype._changeTileLayouts =
    function(tile, oldLayouts, newLayouts) {
		try {
			oldLayouts.forEach(function(layout) {
				layout.removeTile(tile);
			});
			newLayouts.forEach(function(layout) {
				layout.addTile(tile);
			});
		} catch(err) {
			print(err, "in TilingManager._changeTileLayouts");
		}
	};

TilingManager.prototype._onCurrentDesktopChanged = function() {
	// TODO: This is wrong, we need to activate *all* visible layouts
	if (this.layouts[this._currentDesktop][this._currentScreen].active) {
		this.layouts[this._currentDesktop][this._currentScreen].deactivate();
	}
	if (this._currentDesktop === workspace.currentDesktop -1) {
		return;
	}
	this._currentDesktop = workspace.currentDesktop - 1;
	if (! this.layouts[this._currentDesktop][this._currentScreen].active) {
		this.layouts[this._currentDesktop][this._currentScreen].activate();
	}
};

TilingManager.prototype._switchLayout = function(desktop, screen, layoutIndex) {
    // TODO: Show the layout switcher dialog
    var layoutType = this.availableLayouts[layoutIndex];
    this.layouts[desktop][screen].setLayoutType(layoutType);
};

TilingManager.prototype._switchFocus = function(direction) {
	var client = workspace.activeClient;
	if (client == null) {
		return;
	}
	var activeTile = this.tiles.getTile(client);
	if (activeTile == null) {
		return;
	}
	var layout = this.layouts[client.desktop - 1][this._currentScreen];
	var nextTile = layout.getAdjacentTile(activeTile, direction, false);
	if (nextTile != null && nextTile != activeTile) {
		workspace.activeClient = nextTile.getActiveClient();
	}
};

TilingManager.prototype._moveTile = function(direction) {
	var client = workspace.activeClient;
	if (client == null) {
		return;
	}
	var activeTile = this.tiles.getTile(client);
	if (activeTile == null) {
		print("Tile is floating");
		return;
	}
	var layout = this.layouts[client.desktop - 1][this._currentScreen];
	var nextTile = layout.getAdjacentTile(activeTile, direction, true);
	if (nextTile != null && nextTile != activeTile) {
		layout.swapTiles(activeTile, nextTile);
	}
};

TilingManager.prototype._getLayouts = function(desktop, screen) {
	if (desktop > 0) {
		return [this.layouts[desktop - 1][screen]];
	} else if (desktop == 0) {
		return [];
	} else if (desktop == -1) {
		var result = [];
		for (var i = 0; i < this.desktopCount; i++) {
			result.push(this.layouts[i][screen]);
		}
		return result;
	}
}
