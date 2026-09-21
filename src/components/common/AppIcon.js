import React from "react";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Feather from "react-native-vector-icons/Feather";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

const iconLibraries = {
  ionicons: Ionicons,
  materialcommunityicons: MaterialCommunityIcons,
  feather: Feather,
  fontawesome6: FontAwesome6,
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome6,
};

export default function AppIcon({
  library = "Ionicons",
  name,
  size = 24,
  color,
  style,
  ...rest
}) {
  const normalizedLibrary = String(library || "")
    .trim()
    .toLowerCase();
  const IconComponent = iconLibraries[normalizedLibrary] || iconLibraries[library] || Ionicons;

  if (!IconComponent || !name) {
    return null;
  }

  return <IconComponent name={name} size={size} color={color} style={style} {...rest} />;
}
