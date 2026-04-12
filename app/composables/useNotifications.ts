export const useNotifications = () => {
  const sendVerificationEmail = async (_email: string, _token: string) => {
    return;
  };

  const sendPaymentReceivedEmail = async (
    organizationId: string,
    userId: string,
  ) => {
    console.log("[EMAIL] Payment received:", { organizationId, userId });
  };

  const sendAccountActivatedEmail = async (
    organizationName: string,
    email: string,
    dashboardUrl: string,
  ) => {
    console.log("[EMAIL] Account activated:", {
      organizationName,
      email,
      dashboardUrl,
    });
  };

  const sendPaymentRejectedEmail = async (
    organizationName: string,
    email: string,
    reason: string,
  ) => {
    console.log("[EMAIL] Payment rejected:", {
      organizationName,
      email,
      reason,
    });
  };

  return {
    sendVerificationEmail,
    sendPaymentReceivedEmail,
    sendAccountActivatedEmail,
    sendPaymentRejectedEmail,
  };
};
