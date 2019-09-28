version 2.3:
- Workarounds for clients with empty class, firefox' secondary windows (downloads etc), 
  kfind, kcalc and evolution's gpg keyphrase entry dialog
- Smart window placement for floating windows should now work better

version 2.2:
===========

- Some shortcuts are now not bound by default, to focus on the core feature set
- The default layout switching shortcuts have been changed to Meta+Shift+PgUp/PgDown
- Floating windows are remembered across layout switches
- Better support for screen resizing and rotation
- Support for rotating layouts
- Improved handling for maximized clients (requires KWin >= 5.16!)
- Move window left/right now moves the client to another screen if necessary
- The default split ratio for HalfLayout is now configurable

version 2.1:
===========

- The resize bindings now resize by a fraction of the screen, not a certain number of pixels
- "wine" is added to the blacklist
- Preexisting clients are tiled again
- The configuration screen has switched a widget that is now unavailable by default for one that is
- Shortcuts for switching to the next/previous tile
- A new i3-like layout
- The blacklist is now case-insensitive
- The long-standing problem where clients freeze up until they are resized has hopefully been fixed
- A new OSD is shown when switching layouts
- Better multimonitor support
- A whole bunch of minor bug fixes
