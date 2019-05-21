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

Qt.include("signal.js");
Qt.include("tile.js");
Qt.include("tilelist.js");
Qt.include("layout.js");
Qt.include("spirallayout.js");
Qt.include("halflayout.js");
Qt.include("bladelayout.js");
Qt.include("i3layout.js");
Qt.include("tiling.js");
Qt.include("tests.js");
Qt.include("util.js");


/**
 * Class which manages all layouts, connects the various signals and handlers
 * and implements all keyboard shortcuts.
 * @class
 */
function TilingManager(timerResize, timerGeometryChanged) {
    /**
     * Default layout type which is selected for new layouts.
     */
    this.defaultLayout = HalfLayout;

    /**
     * List of all available layout types.
     */
    this.availableLayouts = [
        I3Layout,
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
    this.desktopCount = workspace.desktops;
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
    this.tiles = new TileList(timerGeometryChanged);
    /**
     * Current screen, needed to be able to track screen changes.
     */
    this._currentScreen = workspace.activeScreen;
    /**
     * Current desktop, needed to be able to track screen changes.
     */
    this._currentDesktop = workspace.currentDesktop;
    /**
     * True if a user moving operation is in progress.
     */
    this._moving = false;
    /**
     * Whether tiling is active on all desktops
     * This is overridden by per-desktop settings
     */
    this.userActive = KWin.readConfig("userActive", true);
    /**
     * A signal to be emited on manual layout change
     */
    this.layoutChanged = new Signal();

    this._compacting = false;

    this._timerResize = timerResize;

    // Read layout configuration
    // Format: desktop:layoutname[,...]
    // Negative desktop number deactivates tiling
    this.layoutConfig = [];
    var lC = String(KWin.readConfig("layouts", "")).replace(/ /g,"").split(",");
    for (var i = 0; i < lC.length; i++) {
        var layout = lC[i].split(":");
        try {
            var desktop = parseInt(layout[0]);
        } catch (err) {
            continue;
        }
        var l = this.defaultLayout;
        for (var j = 0; j < this.availableLayouts.length; j++) {
            if (this.availableLayouts[j].name == layout[1]) {
                l = this.availableLayouts[j];
                break;
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
        desktop = desktop;
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

    // We use this to track current screen
    this.tiles.activeClientChanged.connect(function(client) {
        self._currentScreen = client.screen;
    });

    var existingClients = workspace.clientList();
    for (var i=0; i<existingClients.length; i++) {
        self.tiles.addClient(existingClients[i]);
    }

    // Provide initial values for this.tiles.focusHistory
    // NOTE: Set twice to make the 'current' and 'previous' values equal
    this.tiles.trackFocusChanges();
    this.tiles.trackFocusChanges(this.tiles.focusHistory.current);

    // Activate the visible layouts
    // Do it after adding the existingClients to prevent unnecessary geometry changes
    this._getLayouts(workspace.currentDesktop, null).forEach(function(layout) {
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
        self._timerResize.screen = screen;
        self._timerResize.start();
    });
    workspace.currentDesktopChanged.connect(function() {
        self._onCurrentDesktopChanged();
    });
    workspace.clientRemoved.connect(function(client) {
        if (KWin.readConfig("removeEmptyDesktops", false)) {
            self._removeEmptyDesktops();
        }
    });
    // Register keyboard shortcuts
    // KWin versions before 5.8.3 do not have this and will crash if we try to call it
    // So just check if the function is available
    if (KWin.registerShortcut) {
        KWin.registerShortcut("TILING: Next Tiling Layout",
                              "TILING: Next Tiling Layout",
                              "Meta+Shift+PgDown",
                              function() {
                                  var currentLayout = self._getCurrentLayoutType();
                                  var nextIndex = (currentLayout.index + 1) % self.availableLayouts.length;
                                  self._switchLayout(workspace.currentDesktop,
                                                     workspace.activeScreen,
                                                     nextIndex);
                                  self._notifyLayoutChanged();
                              });
        KWin.registerShortcut("TILING: Previous Tiling Layout",
                              "TILING: Previous Tiling Layout",
                              "Meta+Shift+PgUp",
                              function() {
                                  var currentLayout = self._getCurrentLayoutType();
                                  var nextIndex = currentLayout.index - 1;
                                  if (nextIndex < 0) {
                                      nextIndex += self.availableLayouts.length;
                                  }
                                  self._switchLayout(workspace.currentDesktop,
                                                     workspace.activeScreen,
                                                     nextIndex);
                                  self._notifyLayoutChanged();
                              });
        KWin.registerShortcut("TILING: Toggle Floating",
                              "TILING: Toggle Floating",
                              "Meta+F",
                              function() {
                                  var client = workspace.activeClient;
                                  if (client == null) {
                                      print("No active client");
                                      return;
                                  }
                                  // This can be undefined if the client
                                  // has never been seen before
                                  if (client.tiling_floating
                                     || client.tiling_floating == null) {
                                      client.tiling_floating = false;
                                      self.tiles.addClient(client);
                                  } else {
                                      client.tiling_floating = true;
                                      self.tiles.untileClient(client);
                                  }
                              });
        KWin.registerShortcut("TILING: Toggle Border for all",
                              "TILING: Toggle Border for all",
                              "",
                              function() {
                                  self.tiles.toggleNoBorder();
                              });
        KWin.registerShortcut("TILING: Move Window Left",
                              "TILING: Move Window Left",
                              "Meta+Shift+H",
                              function() {
                                  self._moveTile(Direction.Left);
                              });
        KWin.registerShortcut("TILING: Move Window Right",
                              "TILING: Move Window Right",
                              "Meta+Shift+L",
                              function() {
                                  self._moveTile(Direction.Right);
                              });
        KWin.registerShortcut("TILING: Move Window Up",
                              "TILING: Move Window Up",
                              "Meta+Shift+K",
                              function() {
                                  self._moveTile(Direction.Up);
                              });
        KWin.registerShortcut("TILING: Move Window Down",
                              "TILING: Move Window Down",
                              "Meta+Shift+J",
                              function() {
                                  self._moveTile(Direction.Down);
                              });
        KWin.registerShortcut("TILING: Toggle Tiling",
                              "TILING: Toggle Tiling",
                              "Meta+Shift+f11",
                              function() {
                                  var currentScreen = workspace.activeScreen;
                                  var currentDesktop = workspace.currentDesktop - 1;
                                  self.layouts[currentDesktop][currentScreen].toggleUserActive();
                              });
        KWin.registerShortcut("TILING: Tile now",
                              "TILING: Tile now",
                              "",
                              function() {
                                  var currentScreen = workspace.activeScreen;
                                  var currentDesktop = workspace.currentDesktop - 1;
                                  self.layouts[currentDesktop][currentScreen].toggleUserActive();
                                  self.layouts[currentDesktop][currentScreen].toggleUserActive();
                              });
        KWin.registerShortcut("TILING: Swap Window With Master",
                              "TILING: Swap Window With Master",
                              "Meta+Shift+M",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client != null) {
                                          var tile = self.tiles.getTile(client);
                                          if (tile != null) {
                                              var layout = self.layouts[tile.getDesktop() - 1][tile.getScreen()];
                                              if (layout != null) {
                                                  layout.swapTiles(tile, layout.tiles[0]);
                                              }
                                          }
                                      }
                                  } catch(err) {
                                      print(err, "in swap-window-with-master");
                                  }
                              });
        KWin.registerShortcut("TILING: Resize Active Window To The Left",
                              "TILING: Resize Active Window To The Left",
                              "Meta+Alt+H",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client == null) {
                                          return;
                                      }
                                      var tile = self.tiles.getTile(client);
                                      if (tile == null) {
                                          return;
                                      }
                                      var screenRectangle = util.getTilingArea(client.screen, client.desktop);
                                      var delta = Math.floor(screenRectangle.width / 20);
                                      var geom = Qt.rect(tile.rectangle.x - delta,
                                                         tile.rectangle.y,
                                                         tile.rectangle.width + delta,
                                                         tile.rectangle.height);
                                      if (geom.x < screenRectangle.x) {
                                          geom.x = screenRectangle.x;
                                          geom.width = geom.width - 2 * delta;
                                      }
                                      self.layouts[tile.getDesktop() - 1][tile.getScreen()].resizeTileTo(tile, geom);
                                  } catch(err) {
                                      print(err, "in resize-window-to-the-left");
                                  }
                              });
        KWin.registerShortcut("TILING: Resize Active Window To The Right",
                              "TILING: Resize Active Window To The Right",
                              "Meta+Alt+L",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client == null) {
                                          return;
                                      }
                                      var tile = self.tiles.getTile(client);
                                      if (tile == null) {
                                          return;
                                      }
                                      var screenRectangle = util.getTilingArea(client.screen, client.desktop);
                                      var delta = Math.floor(screenRectangle.width / 20);
                                      var geom = Qt.rect(tile.rectangle.x,
                                                         tile.rectangle.y,
                                                         tile.rectangle.width + delta,
                                                         tile.rectangle.height);
                                      if (geom.x + geom.width > screenRectangle.x + screenRectangle.width) {
                                          geom.x = geom.x + delta;
                                          geom.width = (screenRectangle.x + screenRectangle.width) - geom.x;
                                      }
                                      self.layouts[tile.getDesktop() - 1][tile.getScreen()].resizeTileTo(tile, geom);
                                  } catch(err) {
                                      print(err, "in resize-window-to-the-left");
                                  }
                              });
        KWin.registerShortcut("TILING: Resize Active Window To The Top",
                              "TILING: Resize Active Window To The Top",
                              "Meta+Alt+K",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client == null) {
                                          return;
                                      }
                                      var tile = self.tiles.getTile(client);
                                      if (tile == null) {
                                          return;
                                      }
                                      var screenRectangle = util.getTilingArea(client.screen, client.desktop);
                                      var delta = Math.floor(screenRectangle.height / 20);
                                      var geom = Qt.rect(tile.rectangle.x,
                                                         tile.rectangle.y - delta,
                                                         tile.rectangle.width,
                                                         tile.rectangle.height + delta);
                                      if (geom.y < screenRectangle.y) {
                                          geom.y = screenRectangle.y;
                                          geom.height = geom.height - 2 * delta;
                                      }
                                      self.layouts[tile.getDesktop() - 1][tile.getScreen()].resizeTileTo(tile, geom);
                                  } catch(err) {
                                      print(err, "in resize-window-to-the-left");
                                  }
                              });
        KWin.registerShortcut("TILING: Resize Active Window To The Bottom",
                              "TILING: Resize Active Window To The Bottom",
                              "Meta+Alt+J",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client == null) {
                                          return;
                                      }
                                      var tile = self.tiles.getTile(client);
                                      if (tile == null) {
                                          return;
                                      }
                                      var screenRectangle = util.getTilingArea(client.screen, client.desktop);
                                      var delta = Math.floor(screenRectangle.height / 20);
                                      var geom = Qt.rect(tile.rectangle.x,
                                                         tile.rectangle.y,
                                                         tile.rectangle.width,
                                                         tile.rectangle.height + delta);
                                      if (geom.y + geom.height > screenRectangle.y + screenRectangle.height) {
                                          geom.y = geom.y + delta;
                                          geom.height = (screenRectangle.y + screenRectangle.height) - geom.y;
                                      }
                                      self.layouts[tile.getDesktop() - 1][tile.getScreen()].resizeTileTo(tile, geom);
                                  } catch(err) {
                                      print(err, "in resize-window-to-the-left");
                                  }
                              });
        KWin.registerShortcut("TILING: Increase Number Of Masters",
                              "TILING: Increase Number Of Masters",
                              "Meta+*",
                              function() {
                                  try {
                                      self.layouts[self._currentDesktop - 1][self._currentScreen].increaseMaster();
                                  } catch(err) {
                                      print(err, "in Increase-Number-Of-Masters");
                                  }
                              });
        KWin.registerShortcut("TILING: Decrease Number Of Masters",
                              "TILING: Decrease Number Of Masters",
                              "Meta+_",
                              function() {
                                  try {
                                      self.layouts[self._currentDesktop - 1][self._currentScreen].decrementMaster();
                                  } catch(err) {
                                      print(err, "in Decrease-Number-Of-Masters");
                                  }
                              });
        KWin.registerShortcut("TILING: Focus next tile",
                              "TILING: Focus next tile",
                              "",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null) {
                                          var client = workspace.activeClient;
                                          if (client != null) {
                                              var tile = self.tiles.getTile(client);
                                          }
                                      }
                                      if (tile != null) {
                                          var index1 = layout.tiles.indexOf(tile);
                                          if (index1 == layout.tiles.length-1) {
                                              var index2 = 0;
                                          } else {
                                              var index2 = index1 + 1;
                                          }
                                          var activateClient = layout.tiles[index2].clients[0];
                                          workspace.activeClient = activateClient;
                                      }
                                  } catch(err) {
                                      print(err, "in focus-next-tile");
                                  }
                              });
        KWin.registerShortcut("TILING: Focus previous tile",
                              "TILING: Focus previous tile",
                              "",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null) {
                                          var client = workspace.activeClient;
                                          if (client != null) {
                                              var tile = self.tiles.getTile(client);
                                          }
                                      }
                                      if (tile != null) {
                                          var index1 = layout.tiles.indexOf(tile);
                                          if (index1 == 0) {
                                              var index2 = layout.tiles.length-1;
                                          } else {
                                              var index2 = index1 - 1;
                                          }
                                          var activateClient = layout.tiles[index2].clients[0];
                                          workspace.activeClient = activateClient;
                                      }
                                  } catch(err) {
                                      print(err, "in focus-previous-tile");
                                  }
                              });
        KWin.registerShortcut("TILING: Swap with next tile",
                              "TILING: Swap with next tile",
                              "",
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
                                          var index1 = layout.tiles.indexOf(tile);
                                          if (index1 == layout.tiles.length-1) {
                                              var index2 = 0;
                                          } else {
                                              var index2 = index1 + 1;
                                          }
                                          layout.swapTiles(tile, layout.tiles[index2]);
                                      }
                                  } catch(err) {
                                      print(err, "in swap-with-next-tile");
                                  }
                              });
        KWin.registerShortcut("TILING: Swap with previous tile",
                              "TILING: Swap with previous tile",
                              "",
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
                                          var index1 = layout.tiles.indexOf(tile);
                                          if (index1 == 0) {
                                              var index2 = layout.tiles.length-1;
                                          } else {
                                              var index2 = index1 - 1;
                                          }
                                          layout.swapTiles(tile, layout.tiles[index2]);
                                      }
                                  } catch(err) {
                                      print(err, "in swap-with-previous-tile");
                                  }
                              });
        KWin.registerShortcut("TILING-I3: Set Wrap Horizontal Mode",
                              "TILING-I3: Set Wrap Horizontal Mode",
                              "",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null && layout.layout.isI3Layout) {
                                          layout.layout.state = 'horizontalWrap';
                                      }

                                  } catch(err) {
                                      print(err, "in i3-layout-set-wrap-horizontal-mode");
                                  }
                              });
        KWin.registerShortcut("TILING-I3: Set Wrap Vertical Mode",
                              "TILING-I3: Set Wrap Vertical Mode",
                              "",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null && layout.layout.isI3Layout) {
                                          layout.layout.state = 'verticalWrap';
                                      }

                                  } catch(err) {
                                      print(err, "in i3-layout-set-wrap-vertical-mode");
                                  }
                              });
        KWin.registerShortcut("TILING-I3: Set Normal Mode",
                              "TILING-I3: Set Normal Mode",
                              "",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null && layout.layout.isI3Layout) {
                                          layout.layout.state = 'normal';
                                      }

                                  } catch(err) {
                                      print(err, "in i3-layout-set-normal-mode");
                                  }
                              });
        KWin.registerShortcut("TILING: Move Window To New Desktop",
                              "TILING: Move Window To New Desktop",
                              "Meta+Shift+D",
                              function() {
                                  try {
                                      var client = workspace.activeClient;
                                      if (client != null) {
                                          var desktop = 0;
                                          // find first empty desktop
                                          for (var i = 1; i <= self.desktopCount; i++) {
                                              if (self._isDesktopEmpty(i)) {
                                                  desktop = i;
                                                  break;
                                              }
                                          }
                                          // if there is none, create a new one
                                          if (desktop == 0 && self.desktopCount < 20) {
                                              workspace.desktops += 1;
                                              desktop = self.desktopCount;
                                          }
                                          // move the client and activate the desktop
                                          if (desktop > 0) {
                                              client.desktop = desktop;
                                              workspace.currentDesktop = desktop;
                                              workspace.activeClient = client;
                                          }
                                      }
                                  } catch(err) {
                                      print(err, "in move-window-to-new-desktop");
                                  }
                              });
        KWin.registerShortcut("TILING: Dump Clients",
                              "TILING: Dump Clients",
                              "Meta+Shift+Escape",
                              function() {
                                  try {
                                      self._dumpClients();
                                  } catch(err) {
                                      print(err, "in dump-clients");
                                  }
                              });
        KWin.registerShortcut("TILING: Cycle Rotations",
                              "TILING: Cycle Rotations",
                              "Meta+Shift+R",
                              function() {
                                  try {
                                      var layout = self.layouts[workspace.currentDesktop - 1][workspace.activeScreen];
                                      if (layout != null) {
                                          var grav = layout.layout.getGravity();
                                          switch (grav) {
                                              case Gravity.Bottom:
                                                  var newGrav = Gravity.Right;
                                                  break;
                                              case Gravity.Right:
                                                  var newGrav = Gravity.Top;
                                                  break;
                                              case Gravity.Top:
                                                  var newGrav = Gravity.Left;
                                                  break;
                                              case Gravity.Left:
                                                  var newGrav = Gravity.Bottom;
                                                  break;
                                          }
                                          layout.layout.setGravity(newGrav);
                                          layout.resetTileSizes();
                                      }
                                  } catch(err) {
                                      print(err, "in cycle-rotations");
                                  }
                              });
    }
    // registerUserActionsMenu(function(client) {
    //     return {
    //         text : "Toggle floating",
    //         triggered: function () {
    //             client.tiling_floating = ! client.tiling_floating;
    //             if (client.tiling_floating == true) {
    //                 self.tiles.untileClient(client);
    //             } else {
    //                 self.tiles.addClient(client);
    //             }
    //         }
    //     };
    // });
};

TilingManager.prototype.resize = function() {
    this._onScreenResized(this._timerResize.screen);
};

TilingManager.prototype._createDefaultLayouts = function(desktop) {
    var screenLayouts = [];
    var layout = this.defaultLayout;
    var tiling = false;
    var userConfig = false;
    for (var i = 0; i < this.layoutConfig.length; i++) {
        if (this.layoutConfig[i].desktop == desktop) {
            userConfig = true;
            layout = this.layoutConfig[i].layout;
            tiling = this.layoutConfig[i].tiling;
            this.layoutConfig.splice(i,1);
        }
    }
    for (var j = 0; j < this.screenCount; j++) {
        screenLayouts[j] = new Tiling(layout, desktop, j);
        // Either the default is to tile and the desktop hasn't been configured,
        // or the desktop has been set to tile (in which case the default is irrelevant)
        screenLayouts[j].userActive = (this.userActive == true && userConfig == false) || (tiling == true);
    }
    this.layouts[desktop] = screenLayouts;
};

TilingManager.prototype._getCurrentLayoutType = function() {
    var currentLayout = this._getLayouts(this._currentDesktop, this._currentScreen)[0];
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
    var tileLayouts = this._getLayouts(tile.getDesktop(), tile.getScreen());
    var start = KWin.readConfig("placement", 0);
    tileLayouts.forEach(function(layout) {

        // For I3Layout start at the end is the only option that makes sense,
        // so we should ignore the configured value.
        if (layout.layout.isI3Layout) {
            layout.addTile(tile, self.tiles.focusHistory.previous);
            return;
        }

        // Let KWin decide
        if (start == 0) {
            x = tile.originalx;
            y = tile.originaly;
        // Start as master
        } else if (start == 1) {
            var master = layout.getMaster();
            if (master != null && master.rectangle != null) {
                x = master.rectangle.x;
                y = master.rectangle.y;
            } else {
                x = tile.originalx;
                y = tile.originaly;
            }
        // Start at the end
        } else {
            layout.addTile(tile, self.tiles.focusHistory.previous);
            return;
        }
        layout.addTile(tile, self.tiles.focusHistory.previous, x, y);
    });
};

TilingManager.prototype._onTileResized = function(tile) {
    var tileLayouts = this._getLayouts(tile.getDesktop(), tile.getScreen());
    tileLayouts.forEach(function(layout) {
        layout.resizeTile(tile);
    });
};

TilingManager.prototype._getMaster = function(screen, desktop) {
    try {
        var layouts = this._getLayouts(desktop, screen);
        if (layouts != null && layouts.length > 0) {
            return layouts[0].getMaster();
        } else {
            print("No layout");
        }
    } catch(err) {
        print(err, "in _getMaster");
    }
};

TilingManager.prototype._onTileRemoved = function(tile) {
    try {
        var tileLayouts = this._getLayouts(tile.getDesktop(), tile.getScreen());
        tileLayouts.forEach(function(layout) {
            layout.removeTile(tile);
        });
    } catch(err) {
        print(err, "in TilingManager._onTileRemoved");
    }
};

TilingManager.prototype._onNumberDesktopsChanged = function() {
    var self = this;
    var newDesktopCount = workspace.desktops;
    var onAllDesktops = this.tiles.tiles.filter(function(tile) {
        return tile.desktop == -1;
    });
    // FIXME: Is this needed?
    // Remove tiles from desktops which do not exist any more (we only have to
    // care about tiles shown on all desktops as all others have been moved away
    // from the desktops by kwin before)
    for (var i = newDesktopCount; i < this.desktopCount; i++) {
        onAllDesktops.forEach(function(tile) {
            var layouts = self._getLayouts(i, tile.screen);
            layouts.forEach(function(layout) {
                layout.removeTile(tile);
            });
        });
    }
    // Add new desktops
    for (var i = this.desktopCount; i < newDesktopCount; i++) {
        this._createDefaultLayouts(i);
        onAllDesktops.forEach(function(tile) {
            var layouts = self._getLayouts(i, tile.screen);
            layouts.forEach(function(layout) {
                layout.addTile(tile, self.tiles.focusHistory.previous);
            });
        });
    }
    // Remove deleted desktops
    if (this.desktopCount > newDesktopCount) {
        self.layouts.length = newDesktopCount;
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
    if (screen != null) {
        if (screen < this.screenCount) {
            for (var i = 1; i <= this.desktopCount; i++) {
                this._getLayouts(i, screen).forEach(function(layout) {
                    layout.activate();
                });
            }
        }
    } else {
        for (var i = 1; i <= this.desktopCount; i++) {
            for (var screen = 0; screen < this.screenCount; screen++) {
                this._getLayouts(i, screen).forEach(function(layout) {
                    layout.activate();
                });
            }
        }
    }
};

TilingManager.prototype._onTileScreenChanged = function(tile, oldScreen, newScreen) {
    if (oldScreen == newScreen) {
        return;
    }
    // If a tile is moved by the user, screen changes are handled in the move
    // callbacks below
    if (this._moving) {
        return;
    }
    // Use tile desktop for the onAllDesktops case
    var desktop = tile.getDesktop();
    var oldLayouts = this._getLayouts(desktop, oldScreen);
    var newLayouts = this._getLayouts(desktop, newScreen);
    this._changeTileLayouts(tile, oldLayouts, newLayouts);
    };

TilingManager.prototype._onTileDesktopChanged = function(tile, oldDesktop, newDesktop) {
        try {
            if (oldDesktop == newDesktop || this._compacting) {
                return;
            }
            var client = tile.clients[0];
            if (client == null) {
                print("Tile " + tile.tileIndex + " has no client while switching desktops");
                return;
            }
            var oldLayouts = this._getLayouts(oldDesktop, client.screen);
            var newLayouts = this._getLayouts(newDesktop, client.screen);
            // We don't need to handle onAllDesktops special here
            // because removing and readding is a noop
            this._changeTileLayouts(tile, oldLayouts, newLayouts);
        } catch(err) {
            print(err, "in TilingManager._onTileDesktopChanged");
        }
    };

TilingManager.prototype._onTileMovingStarted = function(tile) {
    // NOTE: This supports only one moving window, breaks with multitouch input
    this._moving = true;
    this._movingStartScreen = tile.clients[0].screen;
};

TilingManager.prototype._onTileMovingEnded = function(tile) {
    try {
        var client = tile.clients[0];
        this._moving = false;
        var windowRect = client.geometry;
        if (client.tiling_tileIndex >= 0) {
            if (tile._currentScreen != client.screen) {
                // Transfer the tile from one layout to another layout
                var startLayout =
                    this._getLayouts(this._currentDesktop, tile.getScreen())[0];
                var endLayout = this._getLayouts(this._currentDesktop, client.screen)[0];
                startLayout.removeTile(tile);
                endLayout.addTile(tile,
                                  this.tiles.focusHistory.previous,
                                  windowRect.x + windowRect.width / 2,
                                  windowRect.y + windowRect.height / 2);
            } else {
                // Transfer the tile to a different location in the same layout
                var layout = this._getLayouts(this._currentDesktop, client.screen)[0];
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
};

TilingManager.prototype._changeTileLayouts = function(tile, oldLayouts, newLayouts) {
        try {
            if (oldLayouts != null) {
                oldLayouts.forEach(function(layout) {
                    layout.removeTile(tile);
                });
            }
            if (newLayouts != null) {
                var self = this;
                newLayouts.forEach(function(layout) {
                    layout.tiles.forEach(function(t) {
                        t.unmaximize();
                    });
                    layout.addTile(tile,
                                   self.tiles.focusHistory.previous);
                });
            }
        } catch(err) {
            print(err, "in TilingManager._changeTileLayouts");
        }
    };

TilingManager.prototype._onCurrentDesktopChanged = function() {
    if (this._currentDesktop === workspace.currentDesktop) {
        return;
    }
    var layouts = this._getLayouts(this._currentDesktop, null);
    layouts.forEach(function(layout) {
        if (layout.active) {
            layout.deactivate();
        }
    });
    this._currentDesktop = workspace.currentDesktop;
    var layouts = this._getLayouts(this._currentDesktop, null);
    layouts.forEach(function(layout) {
        if (! layout.active) {
            layout.activate();
        }
    });
};

TilingManager.prototype._notifyLayoutChanged = function() {
    var tiling = this._getLayouts(this._currentDesktop, this._currentScreen)[0];
    this.layoutChanged.emit(tiling.layout);
}

TilingManager.prototype._switchLayout = function(desktop, screen, layoutIndex) {
    // TODO: Show the layout switcher dialog
    var layoutType = this.availableLayouts[layoutIndex];
    this._getLayouts(desktop, screen).forEach(function(layout) {
        layout.setLayoutType(layoutType);
    });
};

TilingManager.prototype._moveTile = function(direction) {
    var client = workspace.activeClient;
    if (client == null) {
        return;
    }
    var activeTile = this.tiles.getTile(client);
    if (activeTile == null) {
        return;
    }
    // If the client is on all desktops, only move it on the current
    var desktop = client.desktop;
    if (desktop == -1 || client.onAllDesktops == true) {
        desktop = this._currentDesktop;
    }
    var layout = this._getLayouts(desktop, this._currentScreen)[0];
    // Add gaps so we don't land in one
    if (direction == Direction.Left) {
        var x = activeTile.rectangle.x - 1 - layout.windowsGapSizeWidth;
        var y = activeTile.rectangle.y + 1;
    } else if (direction == Direction.Right) {
        var x = activeTile.rectangle.x + activeTile.rectangle.width + 1
            + layout.windowsGapSizeWidth;
        var y = activeTile.rectangle.y + 1;
    } else if (direction == Direction.Up) {
        var x = activeTile.rectangle.x + 1;
        var y = activeTile.rectangle.y - 1 - layout.windowsGapSizeHeight;
    } else if (direction == Direction.Down) {
        var x = activeTile.rectangle.x + 1;
        var y = activeTile.rectangle.y + activeTile.rectangle.height + 1
            + layout.windowsGapSizeHeight;
    } else {
        print("Wrong direction in _moveTile");
        return;
    }
    var nextTile = layout.getTile(x, y);
    if (nextTile != null) {
        layout.swapTiles(activeTile, nextTile);
    } else {
        // No tile to swap. Move to next screen in direction
        var targetScreen = util.nextScreenInDirection(this._currentScreen, desktop, direction);
        if (targetScreen != null) {
            var targetRect = workspace.clientArea(KWin.ScreenArea, targetScreen, desktop);
            client.geometry = targetRect;
        }
    }
};

/*
 * Function to get the layouts for a given desktop/screen (or all desktops, if -1)
 * Always returns an array (which is more consistent and would make it easier to switch to a multiple-layouts-per-desktop model
 * FIXME: Add a function to _set_ the layouts
 */
TilingManager.prototype._getLayouts = function(desktop, screen) {
    if (desktop > 0) {
        if (screen != null) {
            return [this.layouts[desktop - 1][screen]];
        } else {
            return this.layouts[desktop - 1];
        }
    } else if (desktop == 0) {
        print("Invalid desktop 0");
        return [];
    } else if (desktop == -1) {
        if (screen != null) {
            var result = [];
            for (var i = 0; i < this.desktopCount; i++) {
                result.push(this.layouts[i][screen]);
            }
            return result;
        } else {
            return this.layouts;
        }
    }
    return null;
};

TilingManager.prototype._isDesktopEmpty = function(desktop) {
    var clients = workspace.clientList();
    var empty = true;
    for (var i = 0; i < clients.length; i++) {
        if (!clients[i].onAllDesktops && clients[i].desktop == desktop) {
            empty = false;
            break;
        }
    }
    return empty;
};

TilingManager.prototype._compactDesktops = function() {
    this._compacting = true;
    for (var destination = 1; destination < this.desktopCount; destination++) {
        if (!this._isDesktopEmpty(destination)) {
            continue;
        }

        for (var source = destination + 1; source <= this.desktopCount; source++) {
            if (this._isDesktopEmpty(source)) {
                continue;
            }
            console.log("moving from to ", source, destination);
            var i;
            for (i = 0; i < this.layouts[destination - 1].length; i++) {
                this.layouts[source - 1][i].deactivate();
                this.layouts[destination - 1][i].deactivate();
                var oldLayout = this.layouts[destination - 1][i];
                this.layouts[destination - 1][i] = this.layouts[source - 1][i];
                this.layouts[source - 1][i] = oldLayout;
                this.layouts[destination - 1][i].desktop = destination;
                this.layouts[source - 1][i].desktop = source;
            }
            var clients = workspace.clientList();
            for (var i = 0; i < clients.length; i++) {
                var cl = clients[i];
                if (!cl.onAllDesktops && cl.desktop == source) {
                    cl.desktop = destination;
                }
            }
            for (i = 0; i < this.layouts[destination - 1].length; i++) {
                this.layouts[source - 1][i].activate();
                this.layouts[destination - 1][i].activate();
            }
            break;
        }
    }
    this._compacting = false;
}

TilingManager.prototype._removeEmptyDesktops = function() {
    var clients = workspace.clientList();

    this._compactDesktops();

    // Desktop 0 is a special desktop for unmapped clients
    // Desktop 1 is not a good candidate for removal
    for (var i = this.desktopCount; i > 1; i--) {
        if (this._isDesktopEmpty(i)) {
            workspace.desktops -= 1;
            if (!workspace.activeClient) {
                var master = this._getMaster(this._currentScreen, this._currentDesktop);
                if (master) {
                    var client = master.getActiveClient();
                    if (!client) {
                        client = master.clients[0];
                    }
                    workspace.activeClient = client;
                }
            }
        } else {
            break;
        }
    }
};

TilingManager.prototype._dumpClients = function() {
    // We build up the dump string to only call `print()` once,
    // to make it clear that this is one call.
    // Especiallly in the journal, this would have each line prefixed with time/date, pid and such.
    var outp = "";
    for (var i = 0; i < this.layouts.length; i++) {
        outp += "Desktop " + i + "\n";
        for(var j = 0; j < this.layouts[i].length; j++) {
            outp += " Screen " + j + "\n";
            for (var k = 0; k < this.layouts[i][j].tiles.length; k++) {
                outp += "  Tile " + k + "\n";
                this.layouts[i][j].tiles[k].clients.forEach(function(c) {
                    outp += "    " + c.resourceClass.toString() + '- "' + c.caption + '"\n';
                });
            }
        }
    }
    print(outp);
}
