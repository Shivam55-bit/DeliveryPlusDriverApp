import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppNavigator from "./src/navigation/AppNavigator";
import { initNotifications } from "./src/services/notificationService";
import { initializeLocationTracking } from "./src/services/locationTrackingService";

export default function App() {
  useEffect(() => {
    initializeLocationTracking().catch((error) => {
      console.warn(
        `[LOCATION_WATCH_STARTED] initialization failed ${error?.code || "unknown"}`
      );
    });

    const unsubscribePromise = initNotifications();
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}