import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../components/common/AppIcon";

import HomeScreen from "../screens/HomeScreen";
import JobsScreen from "../screens/JobsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";

import {
  subscribeUnreadCount,
  fetchDriverUnreadCount,
  getDriverUnreadCount,
} from "../services/notificationService";

const { width } = Dimensions.get("window");

const Tab = createBottomTabNavigator();

// ── Design Tokens ─────────────────────────────────────────────
const PRIMARY = "#2563EB";
const INACTIVE = "#94A3B8";
const TAB_BG = "#FFFFFF";
const ACTIVE_BG = "#EFF6FF";
const isTablet = width >= 768;

// ── Tab Item ──────────────────────────────────────────────────
const TabIcon = ({ focused, icon, label, badgeCount = 0 }) => (
  <View style={styles.tabItem}>
    <View
      style={[styles.iconBadgeWrap, focused && styles.iconBadgeWrapActive]}
    >
      <AppIcon
        library={icon.library}
        name={focused ? icon.active : icon.inactive}
        size={isTablet ? 24 : 22}
        color={focused ? PRIMARY : INACTIVE}
      />
      {badgeCount > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </View>
    <Text style={[styles.label, focused && styles.activeLabel]}>{label}</Text>
  </View>
);

// ── Custom Tab Bar ────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = React.useState(() => getDriverUnreadCount());

  React.useEffect(() => {
    fetchDriverUnreadCount().catch(() => {});
    const unsub = subscribeUnreadCount((count) => {
      setUnreadCount(count);
    });
    return unsub;
  }, []);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const tabLabel =
            route.name === "HomeTab"
              ? "Home"
              : route.name === "JobsTab"
                ? "Jobs"
                : route.name === "AlertsTab"
                  ? "Alerts"
                  : "Profile";

          const tabIcon =
            route.name === "HomeTab"
              ? { library: "Ionicons", active: "home", inactive: "home-outline" }
              : route.name === "JobsTab"
                ? {
                    library: "MaterialCommunityIcons",
                    active: "briefcase",
                    inactive: "briefcase-outline",
                  }
                : route.name === "AlertsTab"
                  ? { library: "Ionicons", active: "notifications", inactive: "notifications-outline" }
                  : { library: "Ionicons", active: "person", inactive: "person-outline" };

          const badgeCount = route.name === "AlertsTab" ? unreadCount : 0;

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.85}
              onPress={onPress}
              style={styles.tabButton}
            >
              <View style={styles.tabButtonInner}>
                <TabIcon
                  focused={focused}
                  label={tabLabel}
                  icon={tabIcon}
                  badgeCount={badgeCount}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Navigator ─────────────────────────────────────────────────
export default function BottomTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              label="Home"
              icon={{ library: "Ionicons", active: "home", inactive: "home-outline" }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="JobsTab"
        component={JobsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              label="Jobs"
              icon={{ library: "MaterialCommunityIcons", active: "briefcase", inactive: "briefcase-outline" }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="AlertsTab"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              label="Alerts"
              icon={{ library: "Ionicons", active: "notifications", inactive: "notifications-outline" }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              label="Profile"
              icon={{ library: "Ionicons", active: "person", inactive: "person-outline" }}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 10,
    zIndex: 20,
    backgroundColor: "transparent",
  },

  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: isTablet ? 78 : 72,
    paddingHorizontal: isTablet ? 18 : 12,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 26,
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    shadowColor: "#15375C",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
  },

  tabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
  },

  tabButtonInner: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
  },

  iconBadgeWrap: {
    width: isTablet ? 48 : 44,
    height: isTablet ? 48 : 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  iconBadgeWrapActive: {
    backgroundColor: ACTIVE_BG,
  },

  label: {
    fontSize: isTablet ? 12 : 10,
    fontWeight: "500",
    color: INACTIVE,
    marginTop: 2,
  },

  activeLabel: {
    color: PRIMARY,
    fontWeight: "700",
  },

  tabBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
});