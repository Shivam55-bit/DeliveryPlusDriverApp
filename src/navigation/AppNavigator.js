import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";

import SplashScreen from "../screens/SplashScreen";
import SignInScreen from "../screens/SignInScreen";
import SignUpScreen from "../screens/SignUpScreen";
import JobDetailScreen from "../screens/JobDetailScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import SignatureScreen from "../screens/SignatureScreen";
import OTPLoginScreen from "../screens/OTPLoginScreen";
import DeliveryHistoryScreen from "../screens/DeliveryHistoryScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProofOfDeliveryScreen from "../screens/ProofOfDeliveryScreen";
import CompleteJobScreen from "../screens/CompleteJobScreen";
import JobCompletionTermsScreen from "../screens/JobCompletionTermsScreen";
import VehicleDetailsScreen from "../screens/VehicleDetailsScreen";
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import TermsScreen from "../screens/TermsScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import BottomTabs from "./BottomTabs";

enableScreens();

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Login"
          component={SignInScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="OTPLogin"
          component={OTPLoginScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Home"
          component={BottomTabs}
          options={{ headerShown: false }}
        />

        <Stack.Group screenOptions={{ presentation: "modal" }}>
          <Stack.Screen
            name="JobDetail"
            component={JobDetailScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="JobCompletionTerms"
            component={JobCompletionTermsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Signature"
            component={SignatureScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="ProofOfDelivery"
            component={ProofOfDeliveryScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="CompleteJob"
            component={CompleteJobScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="DeliveryHistory"
            component={DeliveryHistoryScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="VehicleDetails"
            component={VehicleDetailsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="PaymentMethods"
            component={PaymentMethodsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Terms"
            component={TermsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Privacy"
            component={PrivacyScreen}
            options={{ headerShown: false }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}