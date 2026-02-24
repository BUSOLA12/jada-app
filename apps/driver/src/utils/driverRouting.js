const DRIVER_STATUSES = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

export const resolveDriverPostPermissionRoute = (status) => {
  const normalized = String(status || '').trim().toUpperCase();

  if (normalized === DRIVER_STATUSES.PENDING_REVIEW) {
    return 'PendingReview';
  }

  if (
    normalized === DRIVER_STATUSES.REJECTED ||
    normalized === DRIVER_STATUSES.SUSPENDED
  ) {
    return 'RejectedFixIssues';
  }

  if (normalized === DRIVER_STATUSES.ACTIVE) {
    return 'Approved';
  }

  return 'OnboardingHome';
};

