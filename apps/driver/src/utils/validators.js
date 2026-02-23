export const validatePhoneNumber = (phone) => {
  return normalizePhoneNumber(phone) !== null;
};

export const formatPhoneNumber = (phone) => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;

  const cleaned = normalized.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
};

export const normalizePhoneNumber = (phone) => {
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return null;

  const cleaned = trimmed.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('234')) {
    return `+${cleaned}`;
  }

  return null;
};

export const validateOTP = (otp) => {
  // Check if OTP is 6 digits
  return /^\d{6}$/.test(otp);
};
