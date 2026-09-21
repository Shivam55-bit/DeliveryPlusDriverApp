import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

let pendingNotificationTarget = null;

/**
 * Safe navigation helper that waits if navigation container is not yet mounted.
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate(name, params);
    } catch (err) {
      console.warn("[Navigation] Failed to navigate:", err?.message);
    }
  } else {
    console.log("[Navigation] Container not ready yet. Enqueuing target:", name, params);
    pendingNotificationTarget = { name, params };
  }
}

/**
 * Set a pending notification target (e.g., from cold start / killed state).
 */
export function setPendingNotificationTarget(name, params) {
  pendingNotificationTarget = { name, params };
}

/**
 * Called when NavigationContainer is ready to flush any queued notification target.
 */
export function flushPendingNotificationTarget() {
  if (pendingNotificationTarget && navigationRef.isReady()) {
    const { name, params } = pendingNotificationTarget;
    console.log("[Navigation] Flushing queued notification target:", name, params);
    pendingNotificationTarget = null;
    setTimeout(() => {
      try {
        navigationRef.navigate(name, params);
      } catch (err) {
        console.warn("[Navigation] Failed to flush queued target:", err?.message);
      }
    }, 300);
  }
}
