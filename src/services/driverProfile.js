import API from "./api";

const REQUEST_TIMEOUT_MS = 15000;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toDisplayString = (value) => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const getProfilePayload = (response) => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

export const normaliseDriverProfile = (response) => {
  if (
    isRecord(response) &&
    Object.prototype.hasOwnProperty.call(response, "data") &&
    response.data === null
  ) {
    return null;
  }

  const payload = getProfilePayload(response);
  if (!isRecord(payload)) return null;

  const user = isRecord(payload.user) ? payload.user : null;
  const driver =
    (isRecord(payload.driver) && payload.driver) ||
    (isRecord(payload.driverProfile) && payload.driverProfile) ||
    (isRecord(user?.driverProfile) && user.driverProfile) ||
    (isRecord(user?.driver) && user.driver) ||
    null;
  const account = user || driver || payload;
  const profile = driver && driver !== account
    ? { ...driver, ...account }
    : account;
  const fullName = [
    toDisplayString(profile.firstName),
    toDisplayString(profile.lastName),
  ].filter(Boolean).join(" ");
  const onlineFlag = profile.isOnline ?? profile.online;
  const availability = String(profile.availability || "")
    .trim()
    .toLowerCase();

  const driverIdCandidates = [
    payload.driverId,
    payload.driver_id,
    payload.driverCode,
    payload.driver_code,
    payload.driverNumber,
    payload.driver_number,
    payload.driverNo,
    payload.driver_no,
    driver?.driverId,
    driver?.driver_id,
    driver?.driverCode,
    driver?.driver_code,
    driver?.driverNumber,
    driver?.driver_number,
    driver?.driverNo,
    driver?.driver_no,
    driver?.code,
    driver?.badgeNumber,
    driver?._id,
    driver?.id,
    user?.driverId,
    user?.driver_id,
    user?.driverCode,
    user?.driver_code,
    user?.driverNumber,
    user?.driver_number,
    user?.driverNo,
    user?.driver_no,
    user?.driverProfileId,
    user?.driverProfile?._id,
    user?.driverProfile?.id,
    profile.driverId,
    profile.driver_id,
    profile.driverCode,
    profile.driver_code,
    profile.driverNumber,
    profile.driver_number,
    profile.driverNo,
    profile.driver_no,
    profile.code,
    profile.badgeNumber,
    profile.customId,
    profile.custom_id,
    profile.employeeId,
    profile.employee_id,
  ];

  const driverIdValue =
    driverIdCandidates.find(
      (val) =>
        val !== null &&
        val !== undefined &&
        String(val).trim().length > 0 &&
        String(val).trim().toLowerCase() !== "not available" &&
        String(val).trim().toLowerCase() !== "null" &&
        String(val).trim().toLowerCase() !== "undefined"
    ) ?? null;
  const driverId = toDisplayString(driverIdValue);

  return {
    name:
      toDisplayString(profile.name) ||
      toDisplayString(profile.fullName) ||
      fullName ||
      "Name not provided",
    email: toDisplayString(profile.email) || "Not provided",
    phone:
      toDisplayString(profile.phone) ||
      toDisplayString(profile.phoneNumber) ||
      "Not provided",
    driverId,
    vehicle:
      profile.vehicle ??
      profile.assignedVehicle ??
      profile.vehicleDetails ??
      null,
    profileImage: profile.avatar ?? profile.profileImage ?? null,
    isOnline:
      typeof onlineFlag === "boolean"
        ? onlineFlag
        : ["available", "online"].includes(availability)
          ? true
          : availability === "offline"
            ? false
            : null,
    isVerified: Boolean(
      profile.isVerified ??
        profile.documentsVerified ??
        profile.verificationStatus === "verified"
    ),
    isApproved: Boolean(
      profile.isApproved ?? profile.status === "approved"
    ),
    rating: Number(profile.rating) || 0,
  };
};

export const fetchAuthenticatedDriverProfile = async ({ signal } = {}) => {
  const response = await API.get("/auth/me", {
    timeout: REQUEST_TIMEOUT_MS,
    signal,
  });
  const profile = normaliseDriverProfile(response);

  if (!profile) {
    throw new Error("The authenticated profile response was empty or invalid.");
  }

  return profile;
};

export const validateDriverProfileUpdates = ({ name, phone }) => {
  const errors = {};
  const cleanName = String(name || "").trim();
  const cleanPhone = String(phone || "").trim();

  if (cleanName.length < 2) {
    errors.name = "Enter a name with at least 2 characters.";
  }
  if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 7) {
    errors.phone = "Enter a valid phone number.";
  }

  return errors;
};

export const updateAuthenticatedDriverProfile = ({ name, phone }) =>
  API.put(
    "/driver/profile",
    { name, phone },
    { timeout: REQUEST_TIMEOUT_MS }
  );
