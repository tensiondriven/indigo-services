#!/usr/bin/osascript

-- Screenshot utility for Plane collaboration interface
tell application "System Events"
    -- Find Safari or Chrome window with Plane
    set planeWindows to {}
    
    -- Check Safari
    try
        tell application process "Safari"
            set windowList to windows
            repeat with w in windowList
                try
                    set windowTitle to title of w
                    if windowTitle contains "Plane" then
                        set end of planeWindows to {app:"Safari", window:w, title:windowTitle}
                    end if
                end try
            end repeat
        end tell
    end try
    
    -- Check Chrome
    try
        tell application process "Google Chrome"
            set windowList to windows
            repeat with w in windowList
                try
                    set windowTitle to title of w
                    if windowTitle contains "Plane" then
                        set end of planeWindows to {app:"Chrome", window:w, title:windowTitle}
                    end if
                end try
            end repeat
        end tell
    end try
    
    if length of planeWindows > 0 then
        set planeWindow to item 1 of planeWindows
        set appName to app of planeWindow
        set targetWindow to window of planeWindow
        
        -- Bring Plane window to front
        tell application process appName
            set frontmost to true
            tell targetWindow
                set position to {0, 23} -- Move to top-left
                set size to {1400, 1000} -- Set reasonable size
            end tell
        end tell
        
        delay 1
        
        -- Take screenshot
        set screenshotPath to POSIX path of ((path to desktop folder) as string) & "plane-screenshot-" & (do shell script "date +%Y%m%d-%H%M%S") & ".png"
        
        do shell script "screencapture -x -R0,23,1400,1000 " & quoted form of screenshotPath
        
        return "Screenshot saved: " & screenshotPath
    else
        return "No Plane window found. Make sure Plane is open in Safari or Chrome."
    end if
end tell