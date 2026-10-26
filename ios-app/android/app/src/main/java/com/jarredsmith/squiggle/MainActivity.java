package com.jarredsmith.squiggle;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Draw behind the status and navigation bars like the iPhone app; Capacitor's SystemBars passes the bar sizes
        // to the page as safe-area insets, which the game's layout already uses.
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
    }
}
