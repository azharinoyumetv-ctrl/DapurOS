// Website purchases remain available. The Play client consumes existing access
// until a separately verified Play Billing implementation is available.
export const subscriptionPurchasesAllowed = () => !window.__dapurosAndroid || window.__dapurosSubscriptionPurchases === true;
