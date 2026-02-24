const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BACKGROUND_CHECK_STATUSES,
  DOCUMENT_STATUSES,
  DRIVER_STATUSES,
  REQUIRED_DOCUMENT_TYPES,
  VEHICLE_STATUSES,
  evaluateDriverEligibility,
} = require('../src/services/driverEligibility');

const buildApprovedDocuments = () =>
  REQUIRED_DOCUMENT_TYPES.reduce((acc, type) => {
    acc[type] = {
      type,
      status: DOCUMENT_STATUSES.APPROVED,
      filePath: `driver_docs/test/${type}/sample.jpg`,
    };
    return acc;
  }, {});

test('canSubmitForReview is true when all required onboarding inputs exist', () => {
  const result = evaluateDriverEligibility({
    driver: {
      status: DRIVER_STATUSES.UNVERIFIED,
      accountVerified: true,
    },
    documentsByType: REQUIRED_DOCUMENT_TYPES.reduce((acc, type) => {
      acc[type] = { type, status: DOCUMENT_STATUSES.PENDING, filePath: `${type}.jpg` };
      return acc;
    }, {}),
    vehicle: {
      make: 'Toyota',
      model: 'Corolla',
      year: '2018',
      color: 'Black',
      plate: 'ABC123XY',
      category: 'ECONOMY',
      status: VEHICLE_STATUSES.PENDING,
    },
    agreements: {
      termsAcceptedAt: new Date(),
      safetyAcceptedAt: new Date(),
      commissionAcceptedAt: new Date(),
    },
    backgroundCheck: {
      status: BACKGROUND_CHECK_STATUSES.NOT_STARTED,
    },
  });

  assert.equal(result.canSubmitForReview, true);
  assert.equal(result.missingItems.documents.length, 0);
});

test('canGoOnline is false when not all required documents are approved', () => {
  const docs = buildApprovedDocuments();
  docs.LICENSE.status = DOCUMENT_STATUSES.REJECTED;

  const result = evaluateDriverEligibility(
    {
      driver: {
        status: DRIVER_STATUSES.ACTIVE,
        accountVerified: true,
      },
      documentsByType: docs,
      vehicle: {
        make: 'Toyota',
        model: 'Corolla',
        year: '2018',
        color: 'Black',
        plate: 'ABC123XY',
        category: 'ECONOMY',
        status: VEHICLE_STATUSES.APPROVED,
      },
      agreements: {
        termsAcceptedAt: new Date(),
        safetyAcceptedAt: new Date(),
        commissionAcceptedAt: new Date(),
      },
      backgroundCheck: {
        status: BACKGROUND_CHECK_STATUSES.PASSED,
      },
    },
    {
      backgroundCheckRequired: true,
    }
  );

  assert.equal(result.canGoOnline, false);
  assert.ok(result.blockingReasons.some((item) => item.includes('Documents not fully approved')));
  assert.ok(result.missingItems.rejectedOrExpiredDocuments.includes('LICENSE'));
});

test('canGoOnline is true when active and all requirements are approved', () => {
  const docs = buildApprovedDocuments();

  const result = evaluateDriverEligibility(
    {
      driver: {
        status: DRIVER_STATUSES.ACTIVE,
        accountVerified: true,
      },
      documentsByType: docs,
      vehicle: {
        make: 'Toyota',
        model: 'Corolla',
        year: '2018',
        color: 'Black',
        plate: 'ABC123XY',
        category: 'ECONOMY',
        status: VEHICLE_STATUSES.APPROVED,
      },
      agreements: {
        termsAcceptedAt: new Date(),
        safetyAcceptedAt: new Date(),
        commissionAcceptedAt: new Date(),
      },
      backgroundCheck: {
        status: BACKGROUND_CHECK_STATUSES.PASSED,
      },
    },
    {
      backgroundCheckRequired: true,
    }
  );

  assert.equal(result.canGoOnline, true);
  assert.equal(result.blockingReasons.length, 0);
});

