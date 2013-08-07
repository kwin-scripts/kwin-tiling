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
 * Class which manages connections to a signal and allows for signal/slot event
 * handling.
 * @class
 */
function Signal() {
    this.connected = [];
}

/**
 * Method which connects another handler to the signal.
 *
 * @param f Function which shall be added to the signal.
 */
Signal.prototype.connect = function(f) {
    this.connected.push(f);
};

/**
 * Method which disconnects a function from the signal which as previously been
 * registered with connect().
 *
 * @param f Function which shall be removed from the signal.
 */
Signal.prototype.disconnect = function(f) {
    var index = this.connected.indexOf(f);
    if (index == -1) {
        return;
    }
    this.connected.splice(index, 1);
};

/**
 * Calls all functions attached to this signals with all parameters passed to
 * this function.
 */
Signal.prototype.emit = function() {
    var signalArguments = arguments;
    this.connected.forEach(function(f) {
        f.apply(null, signalArguments);
    });
};
