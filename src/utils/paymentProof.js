const UPLOAD_HOST = "https://api.deliveryplus.tech";

export const extractPaymentProofUrl = (uploadResponse) => {
  const candidates = [
    uploadResponse,
    uploadResponse?.url,
    uploadResponse?.file?.url,
    uploadResponse?.data?.url,
    uploadResponse?.data?.file?.url,
    uploadResponse?.data?.fileUrl,
    uploadResponse?.data?.uploadUrl,
    uploadResponse?.data?.photoUrl,
    uploadResponse?.data?.imageUrl,
    uploadResponse?.paymentProofUrl,
    uploadResponse?.proofUrl,
    uploadResponse?.photoUrl,
    uploadResponse?.imageUrl,
    uploadResponse?.path,
  ];

  const url = candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      candidate.startsWith(`${UPLOAD_HOST}/`)
  );

  return url || null;
};

export const isPaymentProofUrl = (value) =>
  typeof value === "string" && value.startsWith(`${UPLOAD_HOST}/`);

export const getSafeUploadLog = (uploadResponse, paymentProofUrl) => ({
  responseKeys:
    uploadResponse && typeof uploadResponse === "object"
      ? Object.keys(uploadResponse)
      : [],
  paymentProofUrl,
  hasValidUrl: isPaymentProofUrl(paymentProofUrl),
});