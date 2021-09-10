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

var ignored = {};

// A hardcoded list of clients that should never be tiled
ignored._ignoredlist = [
    // If a class is empty, chances are it doesn't behave properly in other ways as well
    "",
    "lattedock",
    "kcalc",
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
    "gcr-prompter",
    "org.kde.krunner",
    "org.kde.yakuake",
    "org.kde.kcalc",
    "org.kde.klipper",
    "org.kde.krunner",
    "org.kde.ksmserver",
    "org.kde.pinentry",
    "org.kde.plasma",
    "org.kde.plasma-desktop",
    "org.kde.plasmashell",
    "urxvt",
]

/**
 * Returns true for clients which shall never be handled by the tiling script,
 * e.g. panels, dialogs or user-defined apps
 * Application workarounds should be put here
 */
ignored.isIgnored = function(client) {
    if (client.tiling_floating == true) {
        return true;
    }
    // TODO: Add regex and more options (by title/caption, override a floater, maybe even a complete scripting language / code)
    // A QLineEdit will backslash-escape ",", so we'll need to split on `\\,`.
    // We trim whitespace around commas, and we lowercase it because kwin lowercases the resourceClass.
    var floaters = KWin.readConfig("floaters", "").toLowerCase().trim().replace(/\s*,\s*/g,",").split("\\,");

    if (floaters.indexOf(client.resourceClass.toString()) > -1
        || floaters.indexOf(client.resourceName.toString()) > -1
        || ignored._ignoredlist.indexOf(client.resourceClass.toString()) > -1) {
        print("Ignoring client because of ignoredlist: ", client.resourceClass.toString());
        return true;
    }
    // HACK: Steam doesn't set the windowtype properly
    // Everything that isn't captioned "Steam" should be a dialog - these resize worse than the main window does
    // With the exception of course of the class-less update/start dialog with the caption "Steam" (*Sigh*)
    if (client.resourceClass.toString() == "steam" && client.caption != "Steam") {
        print("Ignoring client because of steam workaround 1: ", client.resourceClass.toString());
        return true;
    } else if (client.resourceClass.toString() != "steam" && client.caption == "Steam") {
        print("Ignoring client because of steam workaround 2: ", client.resourceClass.toString());
        return true;
    }

    // HACK: Firefox' secondary windows, downloads and such, are normal windows with a class of "firefox".
    // They have a *name* of "places" though, so we can hopefully detect them that way.
    if (client.resourceClass.toString() == "firefox" && client.resourceName == "places") {
        print("Ignoring client because of firefox workaround", client.resourceName);
        return true;
    }

    // KFind is annoying. It sets the window type to dialog (which is arguably wrong) and more importantly sets
    // the transient_for property for some bogus "Qt Client Leader Window".
    //
    // So we whitelist it here - this still allows listing it via class.
    if (client.resourceClass.toString() == "kfind") {
        return false;
    }

    // Transient windows are usually dialogs and such for other windows.
    // Usually, they should also have type = dialog, but often (eclipse and inkscape),
    // they do not. So we should rather ignore them than display them wrong or have them close when they lose focus because we moved them (and FFM was in effect).
    if (client.transient == true) {
        print("Ignoring client because it's transient: ", client.resourceClass.toString());
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
        print("Ignoring client because of window type: ", client.resourceClass.toString());
        return true;
    }

    return false;
};
