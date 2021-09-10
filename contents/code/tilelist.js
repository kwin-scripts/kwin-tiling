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
Qt.include("ignored.js");
/**
 * Class which keeps track of all tiles in the system. The class automatically
 * puts tab groups in one single tile. Tracking of new and removed clients is
 * done here as well.
 * @class
 */
function TileList(timer) {
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
    /**
     * Signal which is triggered whenever a new client is activated.
     */
    this.activeClientChanged = new Signal();

    /**
     * Stores the current and last focused windows.
     * NOTE: We need to keep track of the last focused window because when the addTile
     * function is called, the focused tile has already changed to the new client.
     */
    this.focusHistory = {};

    try {
        this.noBorder = KWin.readConfig("noBorder", false);
    } catch(err) {
        print(err, "in TileList");
    }

    // we use this timer and the array to update client geometry asynchronously
    this.timer = timer;
    this._scheduledUpdates = new Array();

    // We connect to the global workspace callbacks which are triggered when
    // clients are added in order to be able to keep track of the
    // new tiles
    var self = this;
    workspace.clientAdded.connect(function(client) {
        self.addClient(client);
        // NOTE: When a new client is added, activeChanged will be called before it even appears
        // in workspace.clientList(), so we need to keep track of the focus change here as well.
        self.trackFocusChanges(client);
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
                    tile.onClientGeometryChanged(client);
                } else {
                    self.addClient(client);
                }
            }
        });
        client.shadeChanged.connect(function() {
            if (client.shade == true) {
                // Untile shaded clients since we get the unshaded geometry,
                // so we can't otherwise use them.
                self.removeClient(client);
            } else {
                // If we already have a tile, just reset the geometry
                var tile = getTile(client);
                if (tile != null) {
                    client.tiling_floating = false;
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
    // geometryChanged fires also on maximizedStateChanged and stepUserMovedResized
    // (from a cursory reading of the KWin source code)
    // so use geometryShapeChanged
    client.geometryShapeChanged.connect(function() {
        // Only fire this if _we_ aren't the ones resizing.
        // Otherwise we end up in a loop.
        // If we do resize the rectangle again, we fire tile.resizingEnded, which should be enough.
        if (!client.tiling_resize) {
            var tile = getTile(client);
            if (tile != null) {
                self.timer.stop();
                self._scheduledUpdates.push({tile: tile, client: client});
                self.timer.start();
            }
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
    client.activitiesChanged.connect(function(client) {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientActivitiesChanged(client);
        }
    });
    client.desktopChanged.connect(function() {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientDesktopChanged(client);
        }
    });
    client.screenChanged.connect(function() {
        var tile = getTile(client);
        if (tile != null) {
            tile.onClientScreenChanged(client);
        }
        if (client.active == true) {
            self.activeClientChanged.emit(client);
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
    client.activeChanged.connect(function() {
        try {
            self.trackFocusChanges();
            if (client.active == true) {
                self.activeClientChanged.emit(client);
            }
        } catch(err) {
            print(err, "in activeChanged - focus tracking");
        }
    });
    if (client.setMaximize != null) {
        client.activeChanged.connect(function() {
            try {
                // Make sure the newly active client is not covered by
                // a maximized one.
                if (client.active == true) {
                    var screen = client.screen;
                    var desktop = client.desktop;
                    self.tiles.forEach(function(t) {
                        var tileDesktop = t.getDesktop();
                        if (t.maximized == true && t.getScreen() == screen &&
                            (tileDesktop == desktop || tileDesktop == -1))
                        {
                            for (var i = 0; i < t.clients.length; i++) {
                                if (t.clients[i] === client) {
                                    continue;
                                }
                                t.clients[i].setMaximize(false, false);
                            }
                            client.setMaximize(true, true);
                        }
                    });
                }
            } catch(err) {
                print(err, "in activeChanged - setMaximize");
            }
        });
    }
    client.clientMaximizedStateChanged.connect(function(client, h, v) {
        var tile = self.getTile(client);
        if (tile != null) {
            tile.onClientMaximizedStateChanged(client, h, v);
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
    if (ignored.isIgnored(client)) {
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

    // Ignore fullscreen, shaded or minimized clients,
    // but after connecting signals, so
    // they'll be added once that changes.
    if (client.fullScreen
        || client.shade
        || client.minimized) {
        client.keepBelow = false;
        return;
    }

    if (client.setMaximize != null) {
        // Unmaximize the new client.
        client.setMaximize(false, false);

        // Unmaximize the active client if there is already maximized one
        // on the same desktop.
        var screen = client.screen;
        var desktop = client.desktop;
        this.tiles.forEach(function(t) {
            var tileDesktop = t.getDesktop();
            if (t.maximized == true && t.getScreen() == screen &&
               (tileDesktop == desktop || tileDesktop == -1)) {
                    for (var i = 0; i < t.clients.length; i++) {
                        t.clients[i].setMaximize(false, false);
                    }
            }
        });
    }

    this._addTile(client);
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
            tile.active = false;
            this.tiles.splice(tileIndex, 1);
        }
        this.tileRemoved.emit(tile);
    } catch(err) {
        print(err, "in TileList._removeTile");
    }
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
/**
 * Looks for the new focused window when it has changed and updates the
 * focusHistory internal variable consistently
 *
 * @param client Optional. If the newly focused client is passed, it will
 *               be set directly. Otherwise the function will look for it
 */
TileList.prototype.trackFocusChanges = function(focusedClient) {
    try {
        if (!focusedClient) {
            var clients = workspace.clientList();
            for (var i = 0; i < clients.length; ++i) {
                if (clients[i].active) {
                    focusedClient = clients[i];
                    break;
                }
            }
            if (!focusedClient && clients.length > 0) {
                focusedClient = clients[0];
            }
        }
        if (focusedClient && ((focusedClient != this.focusHistory.current) || !this.focusHistory.previous)) {
            this.focusHistory.previous = this.focusHistory.current;
            this.focusHistory.current = focusedClient;
            //print('Focused:' + focusedClient.caption);
        }
    } catch (err) {
        print(err, "in TileList.trackFocusChanges");
    }
};

TileList.prototype.updateGeometry = function() {
    while (this._scheduledUpdates.length > 0) {
        this._scheduledUpdates[0].tile.onClientGeometryChanged(
            this._scheduledUpdates[0].client);
        this._scheduledUpdates.shift();
    }
}
