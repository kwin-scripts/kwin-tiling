/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012 Mathias Gottschlag <mgottschlag@gmail.com>
Copyright (C) 2013-2017 Fabian Homborg <FHomborg@gmail.com>

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
        this.clients = [];
        this.originalx = util.middlex(firstClient.geometry);
        this.originaly = util.middley(firstClient.geometry);
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
        this._currentDesktop = util.getClientDesktop(firstClient);

        this.rectangle = null;

        this.respectMinMax = KWin.readConfig("respectMinMax", true);

        var gapSize = KWin.readConfig("gapSize", 0);  /* stick to old gaps config by default */
        this.windowsGapSizeHeight = KWin.readConfig("windowsGapSizeHeight", gapSize);
        this.windowsGapSizeWidth = KWin.readConfig("windowsGapSizeWidth", gapSize);
        this.screenGapSizeLeft = KWin.readConfig("screenGapSizeLeft", 0);
        this.screenGapSizeRight = KWin.readConfig("screenGapSizeRight", 0);
        this.screenGapSizeTop = KWin.readConfig("screenGapSizeTop", 0);
        this.screenGapSizeBottom = KWin.readConfig("screenGapSizeBottom", 0);
        if (KWin.readConfig("noBorder", false)) {
            firstClient.noBorder = true;
        }
        this.maximized = false;
        this._canSetMaximize = (firstClient.setMaximize != null);
        this.clients.push(firstClient);
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
        if (!geometry) {
            return;
        }
        if (!this.rectangle) {
            this.rectangle = util.copyRect(geometry);
        } else {
            util.setRect(this.rectangle, geometry);
        }
        for (var i = 0; i < this.clients.length; i++) {
            this.setClientGeometry(this.clients[i]);
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
            active = client;
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
        if (!client) {
            client = this.clients[0];
        }
        if (client) {
            client.tiling_tileIndex = this.tileIndex;
        }
    } catch(err) {
        print(err, "in Tile.syncCustomProperties");
    }
};

Tile.prototype.onClientGeometryChanged = function(client) {
    this.setClientGeometry(client);
};

Tile.prototype.setClientGeometry = function(client) {
    try {
        if (!client) {
            return;
        }
        if (client.tiling_resize) {
            return;
        }
        if (client.fullScreen) {
            return;
        }
        if (this.maximized) {
            return;
        }
        if (!this.hasClient(client)) {
            print("Wrong tile called");
            return;
        }
        // These two should never be reached
        if (client.deleted) {
            return;
        }
        if (client.move
            || client.resize
            || !client.resizeable
            || !client.moveable) {
            return;
        }
        if (this._moving || this._resizing) {
            return;
        }
        // This client is bogus
        if (client.minSize.width == client.maxSize.width && client.minSize.height == client.maxSize.width) {
            return;
        }
        if (this.rectangle) {
            // We set keepBelow here to keep tiling clients below,
            // also because that allows us to not set it for floating ones.
            client.keepBelow = true;
            if (client.screen != this._currentScreen) {
                this._currentScreen = client.screen;
            }
            // Respect min/maxSize
            var changedRect = false;
            var screenRect = util.getTilingArea(this._currentScreen, this._currentDesktop);
            // We cannot accomodate this. The client is wrong.
            if (client.minSize.width > screenRect.width
                || client.minSize.height > screenRect.height) {
                return;
            }
            if (client.minSize.width > this.rectangle.width) {
                if (this.rectangle.x + this.rectangle.width == screenRect.x + screenRect.width - this.screenGapSizeRight) {
                    this.rectangle.x = (screenRect.x + screenRect.width - this.screenGapSizeRight) - client.minSize.width;
                }
                this.rectangle.width = client.minSize.width + this.windowsGapSizeWidth;
                changedRect = true;
            }
            if (client.minSize.height > this.rectangle.height) {
                if (this.rectangle.y + this.rectangle.height == screenRect.y + screenRect.height - this.screenGapSizeBottom) {
                    this.rectangle.y = (screenRect.y + screenRect.height - this.screenGapSizeBottom) - client.minSize.height;
                }
                this.rectangle.height = client.minSize.height + this.windowsGapSizeHeight;
                changedRect = true;
            }
            if (client.maxSize.width < this.rectangle.width && client.maxSize.width > 0) {
                if (this.rectangle.x + this.rectangle.width == screenRect.x + screenRect.width - this.screenGapSizeRight) {
                    this.rectangle.x = (screenRect.x + screenRect.width - this.screenGapSizeRight) - client.maxSize.width;
                }
                this.rectangle.width = client.maxSize.width + this.windowsGapSizeWidth;
                changedRect = true;
            }
            if (client.maxSize.height < this.rectangle.height && client.maxSize.height > 0) {
                if (this.rectangle.y + this.rectangle.height == screenRect.y + screenRect.height - this.screenGapSizeBottom) {
                    this.rectangle.y = (screenRect.y + screenRect.height - this.screenGapSizeBottom) - client.maxSize.height;
                }
                this.rectangle.height = client.maxSize.height + this.windowsGapSizeHeight;
                changedRect = true;
            }
            if (client.shade) {
                this.rectangle.height = client.geometry.height;
                changedRect = true;
            }
            // Adjust to the clients basic increments by rounding down to the nearest unit.
            // This will result in a new resize event (changedRect = true)
            // which will then adjust the other clients to match.
            // (it is possible that no perfect fit is possible,
            // which should not cause an infinite loop as all tiles are still marked tiling_resize).

            // basicUnit is apparently not a thing on wayland, so check if it exists.
            if (client.basicUnit) {
                if (client.basicUnit.width > 1) {
                    // floor(deltaWidth / basicUnit) gives the delta in basicUnits.
                    // The rest recomputes the width.
                    var newWidth = Math.floor((this.rectangle.width - client.geometry.width) / client.basicUnit.width)
                        * client.basicUnit.width + client.geometry.width;
                    // If the right edge changed, change the width to match.
                    // If the left edge changed, change that.
                    // Assumption: Either both edges don't change at the same time
                    // or it doesn't matter which we pick.
                    // Not doing this causes corruption (e.g. with a scale of 1.5, unfullscreening vlc).
                    if (client.geometry.x + client.geometry.width != this.rectangle.x + this.rectangle.width) {
                        this.rectangle.width = newWidth;
                    } else if (client.geometry.x != this.rectangle.x) {
                        this.rectangle.x = this.rectangle.x + this.rectangle.width - newWidth;
                    }
                    changedRect = true;
                }
                if (client.basicUnit.height > 1) {
                    // As above, change the edge that changed.
                    var newHeight = Math.floor((this.rectangle.height - client.geometry.height) / client.basicUnit.height)
                        * client.basicUnit.height + client.geometry.height;
                    if (client.geometry.y + client.geometry.height != this.rectangle.y + this.rectangle.height) {
                        this.rectangle.height = newHeight;
                    } else if (client.geometry.y != this.rectangle.y) {
                        this.rectangle.y = this.rectangle.y + this.rectangle.height - newHeight;
                    }
                    changedRect = true;
                }
            }

            client.tiling_resize = true;
            client.geometry = util.copyRect(this.rectangle);

            if (changedRect) {
                this._resizing = true;
                this.resizingEnded.emit();
                this._resizing = false;
            }

            client.tiling_resize = false;
        } else {
            print("No rectangle", client.resourceClass.toString(), client.windowId);
        }
    } catch(err) {
        print(err, "in Tile.setClientGeometry");
    }
};

Tile.prototype.onClientDesktopChanged = function(client) {
    try {
        var oldDesktop = this._currentDesktop;
        this._currentDesktop = util.getClientDesktop(client);
        this.desktopChanged.emit(oldDesktop, this._currentDesktop);
    } catch(err) {
        print(err, "in Tile.onClientDesktopChanged");
    }
};

Tile.prototype.onClientScreenChanged = function(client) {
    try {
        var oldScreen = this._currentScreen;
        this._currentScreen = client.screen;
        this.screenChanged.emit(oldScreen, this._currentScreen);
    } catch(err) {
        print(err, "in Tile.onClientScreenChanged");
    }
};

Tile.prototype.onClientStartUserMovedResized = function(client) {
    // Let client stay above the other tilers so the user sees the move
    client.keepBelow = false;
};

Tile.prototype.onClientStepUserMovedResized = function(client) {
    try {
        if (client.resize) {
            this._resizing = true;
            this.resizingStep.emit();
            // This means it gets "animated"
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
        // Put the client on the same layer as the other tilers again
        client.keepBelow = true;
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
            client.keepBelow = true;
            if (KWin.readConfig("noBorder", false)) {
                client.noBorder = true;
            }
            this.clients.push(client);
            this.syncCustomProperties();
            this.setClientGeometry(client);
        }
    } catch(err) {
        print(err, "in Tile.addClient");
    }
};

Tile.prototype.onClientMaximizedStateChanged = function(client, h, v) {
    try {
        // Set keepBelow to keep maximized clients over tiled ones
        // TODO: We don't distinguish between horizontal and vertical maximization,
        // also there's no way to find that the _user_ caused this.
        // So we might want to ignore maximization entirely.
        if (h || v) {
            client.keepBelow = false;
            // We might get a geometryChanged signal before this
            // so we need to manually maximize the client.
            client.tiling_resize = true;
            client.geometry = workspace.clientArea(KWin.MaximizeFullArea, this._currentScreen, this._currentDesktop);
            client.tiling_resize = false;
            this.maximized = true;
        } else {
            this.maximized = false;
            client.keepBelow = true;
        }
    } catch(err) {
        print(err, "in tile.onClientMaximizedStateChanged");
    }
};

Tile.prototype.hasClient = function(client) {
    return (this.clients.indexOf(client) > -1);
};

Tile.prototype.getDesktop = function() {
    return this._currentDesktop;
}

Tile.prototype.getScreen = function() {
    return this._currentScreen;
}

Tile.prototype.unmaximize = function() {
    if (this._canSetMaximize == true && this.maximized == true) {
        this.clients.forEach(function(c) {
            c.setMaximize(false, false);
        });
    }
}

Tile.prototype.setKeepBelow = function(setting) {
    this.clients.forEach(function(c) {
        c.keepBelow = setting;
    });
}
