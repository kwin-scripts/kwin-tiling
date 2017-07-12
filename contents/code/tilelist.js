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

    try {
        this.noBorder = KWin.readConfig("noBorder", false);
    } catch(err) {
        print(err, "in TileList");
    }

    // A hardcoded list of clients that should never be tiled
    this.blacklist = [
        "Plasma",
        "Wine",
        "klipper",
        "krunner",
        "ksmserver",
        "pinentry",
        "plasma",
        "plasma-desktop",
        "plasmashell",
        "plugin-container",
        "wine",
        "yakuake",
    ]

    // We connect to the global workspace callbacks which are triggered when
    // clients are added in order to be able to keep track of the
    // new tiles
    var self = this;
    workspace.clientAdded.connect(function(client) {
        // TODO: When compositing is on,
        // we need to delay first tiling until the window is shown
        // otherwise we end up with artifacts.
        // However, we can only determine what the option is set to on start
        // neither of (options.):
        // - "useCompositing"
        // - "compositingMode"
        // - "compositingInitialized"
        // change when it is disabled/enabled.
        if (options.useCompositing) {
            client.windowShown.connect(function(client) {
                self.addClient(client);
            });
        } else {
            self.addClient(client);
        }
    });
};

/*
 * Connect all signals for a client we need
 */
TileList.prototype.connectSignals = function(client) {
    var self = this;
    // We have to connect client signals here instead of in Tile
    // because the tile of a client might change over time
    var getTile = function(client) {
        return self.getTile(client);
    };

    if (client.tiling_connected1 != true) {
        // First handle fullscreen as clients become interesting when they unfullscreen
        // We don't need to remove a client on fullscreen as it may be temporary (vlc)
        // and no other client is visible while one is fullscreen (meaning their geom doesn't matter)
        // and we can properly restore the geometry this way
        client.fullScreenChanged.connect(function() {
            if (client.fullScreen == true) {
                client.tiling_floating = true;
                client.keepBelow = false;
            } else {
                // If we already have a tile, just reset the geometry
                var tile = getTile(client);
                if (tile != null) {
                    client.tiling_floating = false;
                    client.keepBelow = true;
                    tile.onClientGeometryChanged(client);
                } else {
                    self.addClient(client);
                }
            }
        });
        client.tiling_connected1 = true;
    }
    if (client.tiling_connected2 == true) {
        return;
    }
    // Just tile the shaded clients since we get the border geometry
    // TODO: This needs improvement in our resizing/tile-finding logic
    client.shadeChanged.connect(function() {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientGeometryChanged(client);
        }
    });
    client.tabGroupChanged.connect(function() {
        self._onClientTabGroupChanged(client);
    });
    // geometryChanged fires also on maximizedStateChanged and stepUserMovedResized
    // (from a cursory reading of the KWin source code)
    // so use geometryShapeChanged
    client.geometryShapeChanged.connect(function() {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientGeometryChanged(client);
        }
    });
    // Do not use clientRemoved as it is called after FFM selects a new active client
    // Instead, connect to client.windowClosed
    client.windowClosed.connect(function(cl, deleted) {
        self.removeClient(client);
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
    client.desktopChanged.connect(function() {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientDesktopChanged(client);
        }
    });
    client.clientMinimized.connect(function(client) {
        try {
            self.untileClient(client);
        } catch(err) {
            print(err, "in mimimized");
        }
    });
    client.clientUnminimized.connect(function(client) {
        try {
            self.addClient(client);
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
    if (this._isIgnored(client)) {
        client.tiling_tileIndex = -1;
        client.keepBelow = false;
        // WARNING: This crashes kwin!
        //client.tiling_floating = true;
        return;
    }

    // Check whether the client is part of an existing tile
    if (this._indexWithClient(client) != -1) {
        return;
    }

    this.connectSignals(client);

    // Ignore fullscreen or minimized clients,
    // but after connecting signals, so
    // they'll be added once that changes.
    if (client.fullScreen
       || client.minimized) {
        client.keepBelow = false;
        return;
    }

    // If the client isn't the current tab, it's added to a tabgroup
    // (because of autogrouping)
    // HACK: Find it by comparing rectangles (yes, really)
    if (client.isCurrentTab == false) {
        for (var i = 0; i < this.tiles.length; i++) {
            if (util.compareRect(this.tiles[i].rectangle, client.geometry) == true) {
                if (this.tiles[i]._currentDesktop == util.getClientDesktop(client)
                    && this.tiles[i]._currentScreen  == client.screen) {
                    this.tiles[i].addClient(client);
                    break;
                }
            }
        }
    } else {
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

/*
 * Untile a client
 * This means undoing things we do to tiled clients
 * and removing them from the list
*/
TileList.prototype.untileClient = function(client) {
    try {
        // Unset keepBelow because we set it when tiling
        client.keepBelow = false;

        // Don't remove tileIndex, so we can move the window to its position in case it comes back (after minimize etc)
        //client.tiling_tileIndex = - 1;
        if (client.tiling_floating == true) {
            client.noBorder = false;
        }

        this.removeClient(client);
    } catch(err) {
        print(err, "in untileClient with", client.resourceClass.toString());
    }
};

/*
 * Remove client from the tileList
*/
TileList.prototype.removeClient = function(client) {
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
};

TileList.prototype._onClientTabGroupChanged = function(client) {
    try {
        // FIXME: This is a huge kludge as kwin doesn't actually export the tabgroup
        // For starters, this only works because we ignore geometryChanged for clients that aren't the current tab
        var index = this._indexWithClient(client);
        if (client.isCurrentTab == false) {
            var tabGroup = null;
            for (var i = 0; i < this.tiles.length; i++) {
                // We don't set geometry if the client isn't currentTab, so find its tabgroup by place
                var rect  = this.tiles[i].rectangle;
                if (util.compareRect(rect, client.geometry) == true) {
                    // TODO: Is this necessary or is desktopChanged always called before tabgroupchanged?
                    if (this.tiles[i]._currentDesktop == util.getClientDesktop(client)) {
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
    var tileIndex = -1;
    if (client.tiling_tileIndex > -1) {
        tileIndex = client.tiling_tileIndex;
    }
    var newTile = new Tile(client, tileIndex);
    this.tiles.push(newTile);
    this.tileAdded.emit(newTile);
};

TileList.prototype._removeTile = function(tileIndex) {
    try {
        // "tileIndex" here is the index in the tileList, while outside this class
        // it's "index in that desktop"
        // That means you should _not_ try changing tile.tileIndex here
        // TODO: Change to a better name
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
 * e.g. panels, dialogs or user-defined apps
 * Application workarounds should be put here
 */
TileList.prototype._isIgnored = function(client) {
    // TODO: Add regex and more options (by title/caption, override a floater, maybe even a complete scripting language / code)
    // A QLineEdit will backslash-escape ",", so we'll need to split on `\\,`.
    var floaters = KWin.readConfig("floaters", "").replace(/ /g,"").split("\\,");
    if (floaters.indexOf(client.resourceClass.toString()) > -1
        || this.blacklist.indexOf(client.resourceClass.toString()) > -1) {
        return true;
    }
    // HACK: Steam doesn't set the windowtype properly
    // Everything that isn't captioned "Steam" should be a dialog - these resize worse than the main window does
    // With the exception of course of the class-less update/start dialog with the caption "Steam" (*Sigh*)
    if (client.resourceClass.toString() == "steam" && client.caption != "Steam") {
        return true;
    } else if (client.resourceClass.toString() != "steam" && client.caption == "Steam") {
        return true;
    }

    // Transient windows are usually dialogs and such for other windows.
    // Usually, they should also have type = dialog, but often (eclipse and inkscape),
    // they do not. So we should rather ignore them than display them wrong or have them close when they lose focus because we moved them (and FFM was in effect).
    if (client.transient == true) {
        return true;
    }

    // Client has a type that shouldn't be tiled
    if (client.specialWindow == true ||
        client.desktopWindow == true ||
        client.dock == true ||
        client.toolbar == true ||
        client.menu == true ||
        client.dialog == true ||
        client.splash == true ||
        client.utility == true ||
        client.dropdownMenu == true ||
        client.popupMenu == true ||
        client.tooltip == true ||
        client.notification == true ||
        client.comboBox == true ||
        client.dndIcon == true) {
        return true;
    }

    return false;
};

TileList.prototype._indexWithClient = function(client) {
    for (var i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i].hasClient(client)) {
            return i;
        }
    }
    return -1;
};

/*
 * Set the border for all non-floating managed clients
 * This is "noBorder" (i.e. inverted boolean) since that's what kwin uses
*/
TileList.prototype.setNoBorder = function(nB) {
    this.noBorder = nB;
    this.tiles.forEach(function (t) {
        for (var i = 0; i < t.clients.length; i++) {
            if (t.clients[i].tiling_floating != true) {
                t.clients[i].noBorder = nB;
            }
        }
    });
};

TileList.prototype.toggleNoBorder = function() {
    try {
        this.setNoBorder(!this.noBorder);
    } catch (err) {
        print(err, "in TileList.toggleNoBorder");
    }
};
