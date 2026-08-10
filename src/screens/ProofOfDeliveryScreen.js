import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
} from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import LinearGradient from "react-native-linear-gradient";
import AppIcon from "../components/common/AppIcon";

export default function ProofOfDeliveryScreen({ navigation, route }) {
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);

  const pickImage = async (mode) => {
    const options = {
      mediaType: "photo",
      quality: 0.7,
      saveToPhotos: true,
    };

    try {
      const result = mode === "camera" ? await launchCamera(options) : await launchImageLibrary(options);
      if (result.didCancel) return;
      if (result.assets && result.assets.length > 0) {
        setPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert("Image Error", "Unable to select photo. Please try again.");
    }
  };

  const handleSubmit = () => {
    if (!photo) {
      Alert.alert("Upload required", "Please add a delivery photo before submitting.");
      return;
    }

    navigation.navigate("Signature", {
      type: "complete",
      jobId: route?.params?.jobId,
      photo,
      notes,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={["#0A2B66", "#123B85"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon library="Ionicons" name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Proof of Delivery</Text>
        </View>
        <Text style={styles.subtitle}>Add a photo and delivery notes to complete the job record.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Photo</Text>
          <TouchableOpacity style={styles.photoBox} onPress={() => pickImage("gallery")} activeOpacity={0.8}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <>
                <AppIcon library="MaterialCommunityIcons" name="camera-outline" size={32} color="#667085" />
                <Text style={styles.photoText}>Tap to add photo</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage("camera")}> 
              <Text style={styles.actionText}>Use Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAlt]} onPress={() => pickImage("gallery")}> 
              <Text style={[styles.actionText, styles.actionTextAlt]}>Pick from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add important delivery remarks..."
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.notesInput}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
          <LinearGradient colors={["#2F80ED", "#0A2B66"]} style={styles.submitGradient}>
            <Text style={styles.submitText}>Submit Proof</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6FA" },
  header: { padding: 24, paddingTop: 44, paddingBottom: 28, borderBottomRightRadius: 32, backgroundColor: "#0A2B66" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginRight: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", flex: 1 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20, marginTop: 4 },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: "rgba(0,0,0,0.08)", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 5 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  photoBox: { height: 220, borderRadius: 22, backgroundColor: "#F8FAFC", borderStyle: "dashed", borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPreview: { width: "100%", height: "100%", borderRadius: 22 },
  photoText: { marginTop: 12, color: "#667085", fontSize: 14 },
  photoActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  actionBtnAlt: { backgroundColor: "#F8FAFC", marginRight: 0, marginLeft: 10 },
  actionText: { color: "#0A2B66", fontWeight: "700" },
  actionTextAlt: { color: "#475467" },
  notesInput: { minHeight: 130, borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", padding: 16, color: "#0F172A", fontSize: 15 },
  submitBtn: { marginTop: 10, borderRadius: 20, overflow: "hidden" },
  submitGradient: { paddingVertical: 18, alignItems: "center", borderRadius: 20 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});