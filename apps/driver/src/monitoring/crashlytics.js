import crashlytics from '@react-native-firebase/crashlytics';

let initialized = false;
let globalHandlerInstalled = false;
let rejectionTrackingInstalled = false;

const normalizeError = (error) => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch (serializationError) {
    return new Error('Unknown error');
  }
};

export const logBreadcrumb = (message) => {
  try {
    crashlytics().log(String(message));
  } catch (_) {}
};

export const recordError = (error, context) => {
  try {
    if (context) {
      crashlytics().log(`Error context: ${String(context)}`);
    }
    crashlytics().recordError(normalizeError(error));
  } catch (_) {}
};

export const setupGlobalErrorHandlers = () => {
  if (!globalHandlerInstalled) {
    const errorUtils = global?.ErrorUtils;
    const hasErrorUtils =
      errorUtils &&
      typeof errorUtils.getGlobalHandler === 'function' &&
      typeof errorUtils.setGlobalHandler === 'function';

    if (hasErrorUtils) {
      const previousHandler = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((error, isFatal) => {
        recordError(error, isFatal ? 'Unhandled JS fatal error' : 'Unhandled JS error');
        if (typeof previousHandler === 'function') {
          previousHandler(error, isFatal);
        }
      });
      globalHandlerInstalled = true;
    }
  }

  if (!rejectionTrackingInstalled) {
    try {
      const rejectionTracking = require('promise/setimmediate/rejection-tracking');
      rejectionTracking.enable({
        allRejections: true,
        onUnhandled: (_id, rejection = {}) => {
          recordError(rejection.reason, 'Unhandled promise rejection');
        },
        onHandled: () => {},
      });
      rejectionTrackingInstalled = true;
    } catch (_) {}
  }
};

export const initCrashlytics = () => {
  if (initialized) {
    return;
  }

  initialized = true;
  try {
    if (!__DEV__) {
      crashlytics().setCrashlyticsCollectionEnabled(true).catch(() => {});
    }
    logBreadcrumb('App started');
  } catch (_) {}
};
